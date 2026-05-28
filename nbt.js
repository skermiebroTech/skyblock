/* =========================================================================
 * nbt.js
 *
 * Minimal NBT parser for SkyBlock inventory data.
 *
 * Hypixel returns each inventory slice (talisman_bag, inv_contents, etc.) as
 *   { type: 0, data: "<base64 gzipped NBT>" }
 *
 * The decoded payload is a single compound that contains a list `i` of item
 * compounds. Each item compound has shape:
 *   { id: <short>, Count: <byte>, Damage: <short>, tag: { ... } }
 * The SkyBlock item id we actually want lives at:
 *   item.tag.ExtraAttributes.id
 *
 * This file exports two helpers on the global window:
 *   decodeInventory(base64String) -> Promise<Array<{id, count, raw}>>
 *   parseNBT(uint8Array)          -> Object
 *
 * The parser is deliberately minimal — it only supports the tag types the
 * SkyBlock inventory format actually uses, and the format never nests more
 * than a few levels deep so we keep the implementation small and readable.
 * ======================================================================= */

"use strict";

const NBT_TAG = {
  END:        0,
  BYTE:       1,
  SHORT:      2,
  INT:        3,
  LONG:       4,
  FLOAT:      5,
  DOUBLE:     6,
  BYTE_ARRAY: 7,
  STRING:     8,
  LIST:       9,
  COMPOUND:  10,
  INT_ARRAY: 11,
  LONG_ARRAY:12,
};

/* ------------------------------------------------------------------------ */
/* Reader — incremental cursor over a Uint8Array, big-endian.                */
/* ------------------------------------------------------------------------ */
class NBTReader {
  constructor(buf) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    this.off  = 0;
    this.dec  = new TextDecoder("utf-8");
  }
  readByte()   { const v = this.view.getInt8(this.off);     this.off += 1; return v; }
  readShort()  { const v = this.view.getInt16(this.off);    this.off += 2; return v; }
  readInt()    { const v = this.view.getInt32(this.off);    this.off += 4; return v; }
  readLong()   {
    /* Most SkyBlock long fields fit comfortably in a JS Number (skill XP,
     * stats, etc.). For huge values use BigInt; we coerce to Number on the
     * caller side for the few fields we read. */
    const hi = this.view.getInt32(this.off);
    const lo = this.view.getUint32(this.off + 4);
    this.off += 8;
    return BigInt(hi) * 4294967296n + BigInt(lo);
  }
  readFloat()  { const v = this.view.getFloat32(this.off);  this.off += 4; return v; }
  readDouble() { const v = this.view.getFloat64(this.off);  this.off += 8; return v; }
  readString() {
    const len = this.view.getUint16(this.off); this.off += 2;
    const slice = new Uint8Array(this.view.buffer, this.view.byteOffset + this.off, len);
    this.off += len;
    return this.dec.decode(slice);
  }
}

/* ------------------------------------------------------------------------ */
/* Tag readers, dispatched by tag type.                                     */
/* ------------------------------------------------------------------------ */
function readTagPayload(reader, tagType) {
  switch (tagType) {
    case NBT_TAG.BYTE:   return reader.readByte();
    case NBT_TAG.SHORT:  return reader.readShort();
    case NBT_TAG.INT:    return reader.readInt();
    case NBT_TAG.LONG:   return reader.readLong();
    case NBT_TAG.FLOAT:  return reader.readFloat();
    case NBT_TAG.DOUBLE: return reader.readDouble();
    case NBT_TAG.STRING: return reader.readString();
    case NBT_TAG.BYTE_ARRAY: {
      const len = reader.readInt();
      const out = new Int8Array(len);
      for (let i = 0; i < len; i++) out[i] = reader.readByte();
      return out;
    }
    case NBT_TAG.INT_ARRAY: {
      const len = reader.readInt();
      const out = new Int32Array(len);
      for (let i = 0; i < len; i++) out[i] = reader.readInt();
      return out;
    }
    case NBT_TAG.LONG_ARRAY: {
      const len = reader.readInt();
      const out = [];
      for (let i = 0; i < len; i++) out.push(reader.readLong());
      return out;
    }
    case NBT_TAG.LIST: {
      const childType = reader.readByte();
      const len       = reader.readInt();
      const out = [];
      for (let i = 0; i < len; i++) out.push(readTagPayload(reader, childType));
      return out;
    }
    case NBT_TAG.COMPOUND: {
      const out = {};
      while (true) {
        const t = reader.readByte();
        if (t === NBT_TAG.END) break;
        const name = reader.readString();
        out[name] = readTagPayload(reader, t);
      }
      return out;
    }
    default:
      throw new Error(`Unknown NBT tag type: ${tagType}`);
  }
}

/* Parse a raw NBT byte buffer to a JS object.
 * The top level is always an unnamed compound holding a named root tag. */
function parseNBT(buf) {
  const reader = new NBTReader(buf);
  const rootType = reader.readByte();
  if (rootType === NBT_TAG.END) return null;
  reader.readString();                       // root name (ignored)
  return readTagPayload(reader, rootType);
}

/* ------------------------------------------------------------------------ */
/* High-level: base64-gzip-NBT  →  array of {id, count, slotIndex}          */
/* ------------------------------------------------------------------------ */
async function decodeInventory(base64Data) {
  if (!base64Data) return [];

  /* 1. base64 → Uint8Array */
  const bin = atob(base64Data);
  const gz = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) gz[i] = bin.charCodeAt(i);

  /* 2. gunzip via the native DecompressionStream API.
   *    Supported in Chrome 80+, Firefox 113+, Safari 16.4+ — i.e. everywhere
   *    we'd run this site. */
  const decompressed = await new Response(
    new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))
  ).arrayBuffer();

  /* 3. parse NBT */
  const root = parseNBT(new Uint8Array(decompressed));
  const items = root?.i || [];

  /* 4. flatten to a simple list */
  return items.map((it, idx) => ({
    slotIndex: idx,
    count:     it?.Count ?? 0,
    skyblockId: it?.tag?.ExtraAttributes?.id || null,
    /* rarity_upgrades=1 means the item has been recombobulated already. */
    recombobulated: (it?.tag?.ExtraAttributes?.rarity_upgrades ?? 0) > 0,
    rawTag:    it?.tag || null,
  })).filter((x) => x.skyblockId);
}

/* Expose on globalThis so script.js can use them without modules. */
window.parseNBT        = parseNBT;
window.decodeInventory = decodeInventory;

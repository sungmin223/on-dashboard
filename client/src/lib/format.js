export const won = (n) => (n == null || n === "" ? "—" : Number(n).toLocaleString("en-US"));
export const num = (n) => (n == null || n === "" ? "—" : Number(n).toLocaleString("en-US"));

/* 공급가 가격대 버킷(원) */
export const PRICE_BUCKETS = [
  { key: "~10만", min: 0, max: 100000 },
  { key: "10~30만", min: 100000, max: 300000 },
  { key: "30~50만", min: 300000, max: 500000 },
  { key: "50~100만", min: 500000, max: 1000000 },
  { key: "100만+", min: 1000000, max: Infinity },
];
export function priceBucket(v) {
  if (v == null) return null;
  return PRICE_BUCKETS.find((b) => v >= b.min && v < b.max)?.key ?? null;
}

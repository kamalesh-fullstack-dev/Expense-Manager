// The database stores whole paise; the API and UI work in rupees.
export const toPaise = (rupees: number) => BigInt(Math.round(rupees * 100));

export const toRupees = (paise: bigint | number) => Number(paise) / 100;

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "TWD", symbol: "NT$", name: "New Taiwan Dollar" },
  { code: "VND", symbol: "₫", name: "Vietnamese Dong" },
  { code: "PKR", symbol: "₨", name: "Pakistani Rupee" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "LKR", symbol: "Rs", name: "Sri Lankan Rupee" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "KRW", symbol: "₩", name: "South Korean Won" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
];

export { CURRENCIES };

export function formatCurrency(amount: number, currencyCode: string): string {
  const currency = CURRENCIES.find((c) => c.code === currencyCode);
  if (!currency) return `${currencyCode} ${amount.toFixed(2)}`;

  // Handle currencies with no decimals
  const noDecimals = ["VND", "KRW", "JPY"];
  const decimals = noDecimals.includes(currencyCode) ? 0 : 2;

  return `${currency.symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

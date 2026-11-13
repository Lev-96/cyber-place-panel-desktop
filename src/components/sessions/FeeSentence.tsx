/**
 * A translated sentence with a money figure in it, the figure in bold: «К
 * счёту места добавится **1 500 ֏**», «Свои продукты **+1 500 ֏**». `{0}`
 * in the template marks where (word order differs between en/ru/am); a
 * template without one (a missing translation) still reads, the figure after.
 */
const FeeSentence = ({ template, amount }: { template: string; amount: string }) => {
  const at = template.indexOf("{0}");
  if (at < 0) return <>{template} <strong>{amount}</strong></>;
  return <>{template.slice(0, at)}<strong>{amount}</strong>{template.slice(at + 3)}</>;
};

export default FeeSentence;

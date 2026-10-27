export function forEachInSequence<T>(
  items: readonly T[],
  task: (item: T) => Promise<void>,
): Promise<void> {
  return items.reduce<Promise<void>>(
    (previous, item) => previous.then(() => task(item)),
    Promise.resolve(),
  );
}

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & unknown;

export const Arr = Object.freeze({
  filterMap: <T, U>(arr: T[], fn: (value: T, index: number) => ({ save: false } | { save: true, value: U })): U[] => {
    const mapped = [] as U[];
    for (let i = 0; i < arr.length; ++i) {
      const result = fn(arr[i], i);
      if (!result.save) continue;
      mapped.push(result.value);
    }
    return mapped;
  },
  findMap: <T, U>(arr: T[], fn: (value: T, index: number) => ({ found: false } | { found: true, value: U })): U | undefined => {
    for (let i = 0; i < arr.length; ++i) {
      const result = fn(arr[i], i);
      if (!result.found) continue;
      return result.value;
    }
    return undefined;
  },
});


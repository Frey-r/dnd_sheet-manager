/** "1 objeto" / "3 objetos": count followed by the singular or plural noun. */
export const countOf = (count: number, singular: string, plural: string) => `${count} ${count === 1 ? singular : plural}`;

export const itemCount = (count: number) => countOf(count, 'objeto', 'objetos');

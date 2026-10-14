export interface EmbeddingProvider {
  readonly model: string;
  embed(
    texts: string[],
    task: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
    correlationId: string,
  ): Promise<number[][]>;
}

export const demoCurriculum = {
  courseTitle: "Data Structures",
  learningOutcomes: ["Explain breadth-first traversal"],
  units: [
    {
      id: "graphs",
      title: "Graphs",
      description: "Graph algorithms",
      concepts: [
        {
          id: "queue",
          title: "Queue",
          description: "FIFO",
          prerequisiteIds: [],
        },
        {
          id: "bfs",
          title: "BFS",
          description: "Breadth-first search",
          prerequisiteIds: ["queue"],
        },
      ],
    },
  ],
};

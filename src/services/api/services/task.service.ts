export type TaskStatus = "pending" | "processing" | "completed" | "failed";

export interface Task {
  id: string;
  status: TaskStatus;
  progress: number;
  result: any | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const tasks = new Map<string, Task>();

export const createTask = (taskId: string): Task => {
  const task: Task = {
    id: taskId,
    status: "pending",
    progress: 0,
    result: null,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  tasks.set(taskId, task);
  return task;
};

export const getTask = (taskId: string): Task | undefined => {
  return tasks.get(taskId);
};

export const updateTask = (
  taskId: string,
  updates: Partial<Omit<Task, "id">>
): Task | undefined => {
  const task = tasks.get(taskId);
  if (task) {
    const updatedTask = { ...task, ...updates, updatedAt: new Date() };
    tasks.set(taskId, updatedTask);
    return updatedTask;
  }
  return undefined;
};

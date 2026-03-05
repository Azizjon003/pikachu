import prisma from '../../../lib/prisma';

export type TaskStatus = "pending" | "processing" | "completed" | "failed";

export interface Task {
  id: string;
  status: TaskStatus;
  progress: number;
  progressText?: string | null;
  result: any | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const toTask = (dbTask: any): Task => ({
  id: dbTask.id,
  status: dbTask.status as TaskStatus,
  progress: dbTask.progress,
  progressText: dbTask.progressText,
  result: dbTask.result,
  error: dbTask.error,
  createdAt: dbTask.createdAt,
  updatedAt: dbTask.updatedAt,
});

export const createTask = async (taskId: string): Promise<Task> => {
  const task = await prisma.task.create({
    data: { id: taskId, status: "pending" },
  });
  return toTask(task);
};

export const getTask = async (taskId: string): Promise<Task | undefined> => {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return undefined;
  return toTask(task);
};

export const updateTask = async (
  taskId: string,
  updates: Partial<Omit<Task, "id">>
): Promise<Task | undefined> => {
  const data: any = {};
  if (updates.status !== undefined) data.status = updates.status;
  if (updates.progress !== undefined) data.progress = updates.progress;
  if (updates.progressText !== undefined) data.progressText = updates.progressText;
  if (updates.result !== undefined) data.result = updates.result;
  if (updates.error !== undefined) data.error = updates.error;

  const task = await prisma.task.update({
    where: { id: taskId },
    data,
  });
  return toTask(task);
};

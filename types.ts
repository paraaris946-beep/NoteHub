
export interface Task {
  id: string;
  title: string;
  time?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category: string;
  reminderAt?: string; // Format: "HH:mm"
  isImportant?: boolean;
  imageUrl?: string; // Base64 data url for task-specific images
}

export interface DayPlan {
  summary: string;
  tasks: Task[];
  motivation: string;
  focus: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  image?: string; // base64 data url
}

export interface UserProfile {
  name: string;
  birthDate: string;
}

export interface UserStats {
  completedTasks: number;
  totalTasks: number;
  mood: string;
  waterIntake: number; // in ml
}

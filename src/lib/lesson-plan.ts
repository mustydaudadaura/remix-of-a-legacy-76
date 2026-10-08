export type LessonHeader = {
  school_name: string; school_address: string; session: string; term: string; week: number;
  class_name: string; subject: string; topic: string; date: string; period: string; duration: string;
  time: string; no_in_class: number; average_age: string; sex: string; teacher: string;
};
export type LessonStep = { stage: string; teacher_activities: string; learning_activities: string; learning_point: string };
export type LessonPlan = {
  sub_topics: string[]; specific_objectives: string[]; rationale: string; previous_knowledge: string;
  instructional_materials: string[]; reference_materials?: string[]; presentation: LessonStep[];
  evaluation: string[]; summary: string; assignment: string[]; lesson_note: string;
  video_searches?: string[];
};

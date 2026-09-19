export type SchoolSession = {
  userId: string;
  sessionId: string;
  studentNo: string;
};
export type Profile = { accountKey: string; label: string };
export type Course = {
  id: string;
  uuid: string;
  name: string;
  teacher: string;
  beginTime: string;
  endTime: string;
  day: string;
  signed: boolean;
};
export type CourseResult = {
  courses: Course[];
  weeklyCourses: Course[];
  fromWeeklyFallback: boolean;
  date: string;
  updatedAt: number;
};
export type SignResult = {
  outcome:
    | "signed"
    | "already_signed"
    | "expired"
    | "outside_window"
    | "unknown";
  message: string;
};
export type ClockSample = {
  schoolAtReceive: number;
  sampledAt: number;
  rtt: number;
};

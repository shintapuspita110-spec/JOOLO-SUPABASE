export type UserDailyQuest = {
  id: string;
  user_id: string;
  task_name: string;
  short_description: string;
  start_date: number;
  end_date: number;
  frequency: "One-Time" | "Daily" | "Weekly";
  level: "Easy" | "Medium" | "Hard";
  total_coin: number;
  target_amount: number | null;
  target_unit: string | null;
  achieved_amount: number;
  is_completed: boolean;
  earned_coin: number;
};

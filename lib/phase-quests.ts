export type PhaseDailyQuest = {
  id: string;
  phase_category_id: string;
  phase_name: string;
  day_number: number;
  focus: string;
  cover_image: string;
  task_name: string;
  short_description: string;
  frequency: string;
  level: "Easy" | "Medium" | "Hard";
  target: string;
  total_coin: number;
  skill_category_id: string;
  soft_skills: string;
  max_possible_coin: number;
};

export type PhaseQuestProgress = {
  quest_id: string;
  achieved_amount: number;
  earned_coin: number;
  progress_updated: boolean;
  completed_at: string | null;
};

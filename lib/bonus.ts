export type BonusType = "ebook" | "tracker";

export type UploadedBonusResource = {
  id: string;
  type: BonusType;
  title: string;
  description: string;
  image_url: string;
  download_url: string;
  created_at: string;
};

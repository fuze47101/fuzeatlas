// @ts-nocheck

export type CampaignType = 'DRIP' | 'ONE_TIME' | 'WEEKLY_DIGEST';
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETE';
export type AudienceType = 'ALL' | 'BRANDS' | 'FACTORIES' | 'ADMINS' | 'CUSTOM';
export type CampaignSendStatus = 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'BOUNCED' | 'FAILED';

export interface CampaignStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  type: CampaignType;
  status: CampaignStatus;
  audience: AudienceType;
  customRecipients?: string[];
  subject: string;
  templateId: string;
  schedule?: string; // cron string or "weekly"
  lastSentAt?: Date;
  nextSendAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
  stats: CampaignStats;
}

export interface CampaignEmail {
  id: string;
  campaignId: string;
  sequenceOrder: number;
  subject: string;
  delayDays: number;
  htmlTemplate: string;
}

export interface CampaignSend {
  id: string;
  campaignId: string;
  recipientEmail: string;
  recipientName: string;
  sentAt: Date;
  status: CampaignSendStatus;
}

export interface Recipient {
  email: string;
  name: string;
  role?: string;
}

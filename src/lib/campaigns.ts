// @ts-nocheck

import { Campaign, CampaignStatus, AudienceType, Recipient } from './campaign-schema';
import { sendEmail } from './email';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// In-memory campaign store with JSON persistence
const campaignStore = new Map<string, Campaign>();

function loadCampaigns() {
  ensureDataDir();
  try {
    if (fs.existsSync(CAMPAIGNS_FILE)) {
      const data = fs.readFileSync(CAMPAIGNS_FILE, 'utf-8');
      const campaigns = JSON.parse(data);
      campaignStore.clear();
      campaigns.forEach((c: Campaign) => {
        campaignStore.set(c.id, {
          ...c,
          createdAt: new Date(c.createdAt),
          updatedAt: c.updatedAt ? new Date(c.updatedAt) : undefined,
          lastSentAt: c.lastSentAt ? new Date(c.lastSentAt) : undefined,
          nextSendAt: c.nextSendAt ? new Date(c.nextSendAt) : undefined,
        });
      });
    }
  } catch (err) {
    console.error('[CAMPAIGNS] Failed to load campaigns:', err);
  }
}

function saveCampaigns() {
  ensureDataDir();
  try {
    const campaigns = Array.from(campaignStore.values());
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2));
  } catch (err) {
    console.error('[CAMPAIGNS] Failed to save campaigns:', err);
  }
}

function generateId(): string {
  return `camp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Initialize on import
loadCampaigns();

export function createCampaign(params: {
  name: string;
  description?: string;
  type: 'DRIP' | 'ONE_TIME' | 'WEEKLY_DIGEST';
  status?: CampaignStatus;
  audience: AudienceType;
  customRecipients?: string[];
  subject: string;
  templateId: string;
  schedule?: string;
}): Campaign {
  const campaign: Campaign = {
    id: generateId(),
    name: params.name,
    description: params.description,
    type: params.type,
    status: params.status || 'DRAFT',
    audience: params.audience,
    customRecipients: params.customRecipients,
    subject: params.subject,
    templateId: params.templateId,
    schedule: params.schedule,
    createdAt: new Date(),
    updatedAt: new Date(),
    stats: {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      failed: 0,
    },
  };

  campaignStore.set(campaign.id, campaign);
  saveCampaigns();
  return campaign;
}

export function updateCampaign(id: string, params: Partial<Campaign>): Campaign {
  const campaign = campaignStore.get(id);
  if (!campaign) {
    throw new Error(`Campaign ${id} not found`);
  }

  const updated = {
    ...campaign,
    ...params,
    id: campaign.id, // Don't allow id change
    createdAt: campaign.createdAt, // Don't allow createdAt change
    updatedAt: new Date(),
  };

  campaignStore.set(id, updated);
  saveCampaigns();
  return updated;
}

export function getCampaigns(): Campaign[] {
  return Array.from(campaignStore.values());
}

export function getCampaign(id: string): Campaign | undefined {
  return campaignStore.get(id);
}

export function deleteCampaign(id: string): void {
  campaignStore.delete(id);
  saveCampaigns();
}

export async function getAudienceRecipients(
  audience: AudienceType,
  customRecipients?: string[]
): Promise<Recipient[]> {
  if (audience === 'CUSTOM' && customRecipients) {
    return customRecipients.map((email) => ({
      email,
      name: email.split('@')[0],
    }));
  }

  // Query Prisma for real user data
  try {
    const { prisma } = await import('./prisma');

    if (audience === 'ALL') {
      const users = await prisma.user.findMany({
        where: { email: { not: null }, status: 'ACTIVE' },
        select: { name: true, email: true },
      });
      return users.map((u) => ({ email: u.email || '', name: u.name }));
    }

    if (audience === 'BRANDS') {
      const users = await prisma.user.findMany({
        where: {
          email: { not: null },
          status: 'ACTIVE',
          role: 'BRAND_USER',
        },
        select: { name: true, email: true },
      });
      return users.map((u) => ({ email: u.email || '', name: u.name }));
    }

    if (audience === 'FACTORIES') {
      const users = await prisma.user.findMany({
        where: {
          email: { not: null },
          status: 'ACTIVE',
          role: 'FACTORY_USER',
        },
        select: { name: true, email: true },
      });
      return users.map((u) => ({ email: u.email || '', name: u.name }));
    }

    if (audience === 'ADMINS') {
      const users = await prisma.user.findMany({
        where: {
          email: { not: null },
          status: 'ACTIVE',
          role: { in: ['ADMIN', 'EMPLOYEE'] },
        },
        select: { name: true, email: true },
      });
      return users.map((u) => ({ email: u.email || '', name: u.name }));
    }
  } catch (err) {
    console.error('[CAMPAIGNS] Failed to fetch audience recipients:', err);
  }

  return [];
}

export async function executeCampaign(id: string): Promise<{ sent: number; failed: number }> {
  const campaign = getCampaign(id);
  if (!campaign) {
    throw new Error(`Campaign ${id} not found`);
  }

  if (campaign.status !== 'ACTIVE' && campaign.status !== 'DRAFT') {
    throw new Error(`Campaign ${campaign.id} is ${campaign.status.toLowerCase()}`);
  }

  // Get recipients
  const recipients = await getAudienceRecipients(campaign.audience, campaign.customRecipients);

  if (recipients.length === 0) {
    console.warn('[CAMPAIGNS] No recipients found for campaign', campaign.id);
    return { sent: 0, failed: 0 };
  }

  // Send emails
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      // Get template HTML - this would be populated by the API route or template engine
      const templateId = campaign.templateId;
      let html = `<p>Campaign: ${campaign.name}</p><p>Subject: ${campaign.subject}</p>`;

      const result = await sendEmail({
        to: recipient.email,
        subject: campaign.subject,
        html,
      });

      if (result.ok) {
        sent++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error('[CAMPAIGNS] Failed to send to', recipient.email, err);
      failed++;
    }
  }

  // Update campaign stats and timestamps
  updateCampaign(id, {
    lastSentAt: new Date(),
    status: campaign.status === 'DRAFT' ? 'ACTIVE' : campaign.status,
    stats: {
      ...campaign.stats,
      sent: campaign.stats.sent + sent,
      failed: campaign.stats.failed + failed,
    },
  });

  return { sent, failed };
}

export function scheduleWeeklyDigest(): Campaign {
  const existing = getCampaigns().find(
    (c) => c.type === 'WEEKLY_DIGEST'
  );

  if (existing) {
    return existing;
  }

  return createCampaign({
    name: 'Weekly Intelligence Brief',
    description: 'Automated weekly digest with test data, news, and platform updates',
    type: 'WEEKLY_DIGEST',
    status: 'ACTIVE',
    audience: 'BRANDS',
    subject: 'FUZE Atlas Weekly Intelligence Brief',
    templateId: 'weekly-digest',
    schedule: '0 8 * * 1', // Every Monday at 8 AM
  });
}

// Helper: Get stats for a campaign
export function getCampaignStats(id: string) {
  const campaign = getCampaign(id);
  if (!campaign) return null;
  return campaign.stats;
}

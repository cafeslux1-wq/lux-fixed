/**
 * trustscore.js — Customer loyalty & TrustScore module.
 */

import api   from '../api/client.js';
import { EP } from '../api/endpoints.js';
import Toast from './toast.js';

const TIERS = {
  bronze:   { label: 'Bronze',   icon: '🥉', min: 0,   max: 300  },
  silver:   { label: 'Silver',   icon: '🥈', min: 300,  max: 500  },
  gold:     { label: 'Gold',     icon: '🥇', min: 500,  max: 700  },
  platinum: { label: 'Platinum', icon: '💎', min: 700,  max: 900  },
  diamond:  { label: 'Diamond',  icon: '💠', min: 900,  max: 1000 },
};

function getTier(score) {
  return Object.values(TIERS).reverse().find(t => score >= t.min) || TIERS.bronze;
}

const TrustScore = {
  async getProfile(phone) {
    try {
      const customers = await api.get(`${EP.CUSTOMERS}?phone=${encodeURIComponent(phone)}`);
      const customer  = Array.isArray(customers) ? customers[0] : customers;
      if (!customer) return null;
      const tier = getTier(customer.trustProfile?.score || 0);
      return { ...customer, tier };
    } catch { return null; }
  },

  async addPoints(customerId, delta) {
    try {
      await api.patch(EP.LOYALTY(customerId), { pointsDelta: delta });
      Toast.success(`✅ ${delta > 0 ? '+' : ''}${delta} points mis à jour`);
      return true;
    } catch (e) {
      Toast.error('❌ ' + e.message);
      return false;
    }
  },

  renderBadge(customer, containerId) {
    const container = document.getElementById(containerId);
    if (!container || !customer) return;
    const tier = getTier(customer.trustProfile?.score || 0);
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:20px">${tier.icon}</span>
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text)">${customer.name}</div>
          <div style="font-size:10px;color:var(--gold)">${tier.label} · ${customer.loyaltyPoints || 0} pts</div>
        </div>
      </div>`;
  },
};

export default TrustScore;
export { getTier, TIERS };

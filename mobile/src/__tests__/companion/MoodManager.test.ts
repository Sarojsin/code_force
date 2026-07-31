import { MoodManager } from '../../services/companion/MoodManager';

describe('MoodManager', () => {
  let manager: MoodManager;

  beforeEach(() => {
    manager = new MoodManager();
  });

  it('returns stable with < 3 entries', () => {
    expect(manager.addMood('happy')).toBe('stable');
    expect(manager.addMood('happy')).toBe('stable');
  });

  it('returns improving when mood scores rise', () => {
    manager.addMood('sad');
    manager.addMood('neutral');
    manager.addMood('happy');
    expect(manager.addMood('happy')).toBe('improving');
  });

  it('returns declining when mood scores drop', () => {
    manager.addMood('happy');
    manager.addMood('neutral');
    manager.addMood('sad');
    expect(manager.addMood('sad')).toBe('declining');
  });

  it('returns volatile with large swings', () => {
    manager.addMood('happy');
    manager.addMood('angry');
    manager.addMood('happy');
    expect(manager.addMood('angry')).toBe('volatile');
  });

  it('returns recommendation for sad', () => {
    const rec = manager.getRecommendation('sad');
    expect(rec).toContain("I'm here for you");
  });

  it('returns null for happy', () => {
    expect(manager.getRecommendation('happy')).toBeNull();
  });

  it('getHistory returns copy', () => {
    manager.addMood('happy');
    expect(manager.getHistory()).toEqual(['happy']);
  });

  it('accepts initial history', () => {
    const m = new MoodManager(['happy', 'happy', 'happy']);
    expect(m.addMood('happy')).toBe('stable');
  });

  it('caps history at 5', () => {
    manager.addMood('happy');
    manager.addMood('sad');
    manager.addMood('anxious');
    manager.addMood('angry');
    manager.addMood('neutral');
    manager.addMood('happy');
    expect(manager.getHistory().length).toBe(5);
  });
});

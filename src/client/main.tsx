import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type DuplicateCase = {
  id: string;
  duplicatePostId: string;
  duplicateTitle: string;
  duplicatePermalink?: string;
  originalPostId: string;
  originalTitle: string;
  originalPermalink?: string;
  similarityScore: number;
  aiExplanation?: string;
  subredditName: string;
  createdAt: number;
  status: 'pending' | 'redirected' | 'removed' | 'ignored';
};

type ThreadScoutSettings = {
  sensitivity: 'low' | 'medium' | 'high';
  actionMode: 'flag_only' | 'comment_only';
  lookbackWindow: '24h' | '7d' | '30d';
};

function App() {
  const [cases, setCases] = useState<DuplicateCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingCaseId, setWorkingCaseId] = useState<string | null>(null);

  const [settings, setSettings] = useState<ThreadScoutSettings>({
    sensitivity: 'medium',
    actionMode: 'flag_only',
    lookbackWindow: '7d',
  });

  const [savingSettings, setSavingSettings] = useState(false);

  async function loadCases() {
    try {
      const res = await fetch('/api/cases');
      const data = await res.json();
      setCases(data.cases ?? []);
    } catch (error) {
      console.error('Failed to load cases:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();

      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async function saveSettings(nextSettings: ThreadScoutSettings) {
    setSavingSettings(true);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(nextSettings),
      });

      const data = await res.json();

      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSavingSettings(false);
    }
  }

  function updateSettings(nextSettings: ThreadScoutSettings) {
    setSettings(nextSettings);
    saveSettings(nextSettings);
  }

  async function handleAction(
    id: string,
    action: 'comment-redirect' | 'remove' | 'ignore'
  ) {
    setWorkingCaseId(id);

    try {
      const res = await fetch(`/api/cases/${id}/${action}`, {
        method: 'POST',
      });

      if (!res.ok) {
        console.error(`Action failed: ${action}`, await res.text());
        return;
      }

      await loadCases();
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
    } finally {
      setWorkingCaseId(null);
    }
  }

  useEffect(() => {
    loadCases();
    loadSettings();
  }, []);

  const pendingCases = cases.filter((item) => item.status === 'pending');

  const averageSimilarity =
    pendingCases.length === 0
      ? 0
      : Math.round(
          pendingCases.reduce((sum, item) => sum + item.similarityScore, 0) /
            pendingCases.length
        );

  return (
    <main className="dashboard">
      <section className="hero">
        <div>
          <p className="eyebrow">ThreadScout</p>
          <h1>Duplicate Review Dashboard</h1>
          <p className="subtext">
            Review posts flagged as possible duplicates and choose the right mod action.
          </p>
        </div>

        <div className="stats">
          <div className="statCard">
            <strong>{pendingCases.length}</strong>
            <span>Pending cases</span>
          </div>

          <div className="statCard">
            <strong>{averageSimilarity}%</strong>
            <span>Avg. match</span>
          </div>
        </div>
      </section>

      <section className="settingsPanel">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>Moderation Controls</h2>
          <p className="subtext">
            Adjust how sensitive ThreadScout is and what it does when it finds a likely duplicate.
          </p>
        </div>

        <div className="settingsGrid">
          <label className="settingsField">
            Sensitivity
            <select
              value={settings.sensitivity}
              onChange={(e) => {
                updateSettings({
                  ...settings,
                  sensitivity: e.target.value as ThreadScoutSettings['sensitivity'],
                });
              }}
            >
              <option value="low">Low — fewer flags</option>
              <option value="medium">Medium — balanced</option>
              <option value="high">High — more sensitive</option>
            </select>
            <small className="helperText">
              Higher sensitivity detects more duplicates but may increase false positives.
            </small>
          </label>

          <label className="settingsField">
            Auto-Response
            <select
              value={settings.actionMode}
              onChange={(e) => {
                updateSettings({
                  ...settings,
                  actionMode: e.target.value as ThreadScoutSettings['actionMode'],
                });
              }}
            >
              <option value="flag_only">Flag for review only</option>
              <option value="comment_only">Auto-comment on likely duplicates</option>
            </select>
            <small className="helperText">
              Controls whether ThreadScout comments automatically or waits for moderator review.
            </small>
          </label>

          <label className="settingsField">
            Lookback Window
            <select
              value={settings.lookbackWindow}
              onChange={(e) => {
                updateSettings({
                  ...settings,
                  lookbackWindow: e.target.value as ThreadScoutSettings['lookbackWindow'],
                });
              }}
            >
              <option value="24h">Past 24 hours</option>
              <option value="7d">Past 7 days</option>
              <option value="30d">Past 30 days</option>
            </select>
            <small className="helperText">
              Limits duplicate checks to recently indexed posts.
            </small>
          </label>
        </div>

        <p className="settingsStatus">
          {savingSettings ? 'Saving settings…' : 'All changes saved ✓'}
        </p>
      </section>

      <section className="caseList">
        {loading ? (
          <div className="emptyState">Loading duplicate cases…</div>
        ) : pendingCases.length === 0 ? (
          <div className="emptyState">No duplicate cases waiting 🎉</div>
        ) : (
          pendingCases.map((item) => {
            const isWorking = workingCaseId === item.id;

            return (
              <article className="caseCard" key={item.id}>
                <div className="caseHeader">
                  <div>
                    <p className="matchBadge">
                      {Math.round(item.similarityScore)}% match
                    </p>
                    <h2>{item.duplicateTitle}</h2>
                    <p className="meta">
                      Possible duplicate of: {item.originalTitle}
                    </p>
                  </div>
                </div>

                {item.aiExplanation && (
                  <p className="aiExplanation">
                    🤖 {item.aiExplanation}
                  </p>
                )}

                <div className="linkRow">
                  {item.duplicatePermalink && (
                    <a
                      href={`https://www.reddit.com${item.duplicatePermalink}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View flagged post
                    </a>
                  )}

                  {item.originalPermalink && (
                    <a
                      href={`https://www.reddit.com${item.originalPermalink}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View original
                    </a>
                  )}
                </div>

                <div className="actionRow">
                  <button
                    disabled={isWorking}
                    onClick={() => handleAction(item.id, 'comment-redirect')}
                  >
                    {isWorking ? 'Working…' : 'Comment + Redirect'}
                  </button>

                  <button
                    className="danger"
                    disabled={isWorking}
                    onClick={() => handleAction(item.id, 'remove')}
                  >
                    {isWorking ? 'Working…' : 'Remove Duplicate'}
                  </button>

                  <button
                    className="secondary"
                    disabled={isWorking}
                    onClick={() => handleAction(item.id, 'ignore')}
                  >
                    {isWorking ? 'Working…' : 'Ignore'}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
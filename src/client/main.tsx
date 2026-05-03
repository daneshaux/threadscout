import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import logoUrl from '../assets/logo.png';
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

function Header() {
  return (
    <header className="appHeader">
      <img className="appLogo" src={logoUrl} alt="ThreadScout" />
      <h1>Duplicate Review Dashboard</h1>
      <p className="subtext">
        Review posts flagged as possible duplicates and choose the right mod action.
      </p>
    </header>
  );
}

type StatsCardsProps = {
  pendingCount: number;
  averageSimilarity: number;
};

function StatsCards({ pendingCount, averageSimilarity }: StatsCardsProps) {
  return (
    <div className="stats">
      <div className="statCard">
        <strong>{pendingCount}</strong>
        <span>Pending cases</span>
      </div>

      <div className="statCard">
        <strong>{averageSimilarity}%</strong>
        <span>Average match</span>
      </div>
    </div>
  );
}

type SettingsToggleProps = {
  expanded: boolean;
  onToggle: () => void;
};

function SettingsToggle({ expanded, onToggle }: SettingsToggleProps) {
  return (
    <button
      className="settingsToggle"
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
    >
      <span className="settingsChevron" aria-hidden="true" />
      <span>Settings</span>
    </button>
  );
}

function App() {
  const [cases, setCases] = useState<DuplicateCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingCaseId, setWorkingCaseId] = useState<string | null>(null);
  const [settingsExpanded, setSettingsExpanded] = useState(false);

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
      <section className="headerStatsArea">
        <div className="headerStatsTop">
          <Header />
          <StatsCards
            pendingCount={pendingCases.length}
            averageSimilarity={averageSimilarity}
          />
        </div>

        <SettingsToggle
          expanded={settingsExpanded}
          onToggle={() => {
            setSettingsExpanded((current) => !current);
          }}
        />
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

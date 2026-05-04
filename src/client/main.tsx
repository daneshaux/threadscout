import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import chevronIconUrl from '../assets/chevron.svg';
import checkedIconUrl from '../assets/checked.svg';
import searchIconUrl from '../assets/Search.svg';
import selectedIconUrl from '../assets/selected.svg';
import successIconUrl from '../assets/success.svg';
import uncheckedIconUrl from '../assets/unchecked.svg';
import warningIconUrl from '../assets/warning.svg';
import logoUrl from '../assets/logo.png';
import openIconUrl from '../assets/openIcon.svg';
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

type CaseAction = 'comment-redirect' | 'remove' | 'ignore';
type Sensitivity = 'low' | 'medium' | 'high';
type LookbackWindow = '24h' | '7d' | '30d';

type RemoveConfirmationState =
  | {
      kind: 'single';
      id: string;
    }
  | {
      kind: 'bulk';
      ids: string[];
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

type SettingsCardProps = {
  expanded: boolean;
  sensitivity: Sensitivity;
  autoResponseEnabled: boolean;
  lookbackWindow: LookbackWindow;
  lookbackOpen: boolean;
  onToggleExpanded: () => void;
  onSensitivityChange: (value: Sensitivity) => void;
  onAutoResponseChange: (value: boolean) => void;
  onLookbackChange: (value: LookbackWindow) => void;
  onLookbackOpenChange: (value: boolean) => void;
};

const sensitivityStops: Sensitivity[] = ['low', 'medium', 'high'];

const lookbackOptions: Array<{ label: string; value: LookbackWindow }> = [
  { label: 'Past 24 hours', value: '24h' },
  { label: 'Past 7 days', value: '7d' },
  { label: 'Past 30 days', value: '30d' },
];

function SettingsCard({
  expanded,
  sensitivity,
  autoResponseEnabled,
  lookbackWindow,
  lookbackOpen,
  onToggleExpanded,
  onSensitivityChange,
  onAutoResponseChange,
  onLookbackChange,
  onLookbackOpenChange,
}: SettingsCardProps) {
  const sensitivityIndex = sensitivityStops.indexOf(sensitivity);
  const selectedLookbackLabel =
    lookbackOptions.find((option) => option.value === lookbackWindow)?.label ??
    'Past 7 days';

  return (
    <section className="settingsCard">
      <SettingsToggle expanded={expanded} onToggle={onToggleExpanded} />

      {expanded && (
        <div className="settingsContent">
          <p className="settingsDescription">
            Adjust how sensitive ThreadScout is and what it does when it finds a likely duplicate.
          </p>

          <div className="settingsSections">
            <div className="settingsSection settingsSectionSensitivity">
              <label className="settingsLabel" htmlFor="sensitivity-slider">
                Sensitivity
              </label>
              <div className="sensitivityControl">
                <div className="sensitivityLabels" aria-hidden="true">
                  <span>Low</span>
                  <span>High</span>
                </div>
                <input
                  id="sensitivity-slider"
                  className="sensitivitySlider"
                  type="range"
                  min="0"
                  max="2"
                  step="1"
                  value={sensitivityIndex}
                  onChange={(event) => {
                    const nextSensitivity =
                      sensitivityStops[Number(event.target.value)];
                    if (nextSensitivity) {
                      onSensitivityChange(nextSensitivity);
                    }
                  }}
                />
              </div>
              <p className="settingsHelper">
                Higher sensitivity detects more duplicates, but may increase false positives.
              </p>
            </div>

            <div className="settingsSection settingsSectionAutoResponse">
              <span className="settingsLabel">Auto-response</span>
              <button
                className={
                  autoResponseEnabled
                    ? 'autoResponseToggle autoResponseToggleEnabled'
                    : 'autoResponseToggle'
                }
                type="button"
                aria-pressed={autoResponseEnabled}
                onClick={() => {
                  onAutoResponseChange(!autoResponseEnabled);
                }}
              >
                <span>{autoResponseEnabled ? 'Enabled' : 'Disabled'}</span>
                <span className="autoResponseThumb" aria-hidden="true" />
              </button>
              <p className="settingsHelper">
                When enabled, ThreadScout will automatically comment without waiting for moderator review.
              </p>
            </div>

            <div className="settingsSection settingsSectionLookback">
              <span className="settingsLabel">Lookback Window</span>
              <div className="lookbackDropdown">
                <button
                  className="lookbackButton"
                  type="button"
                  aria-expanded={lookbackOpen}
                  onClick={() => {
                    onLookbackOpenChange(!lookbackOpen);
                  }}
                >
                  <span>{selectedLookbackLabel}</span>
                  <img
                    className={
                      lookbackOpen
                        ? 'lookbackChevron lookbackChevronOpen'
                        : 'lookbackChevron'
                    }
                    src={chevronIconUrl}
                    alt=""
                  />
                </button>

                {lookbackOpen && (
                  <div className="lookbackOptions">
                    {lookbackOptions.map((option) => {
                      const isSelected = option.value === lookbackWindow;

                      return (
                        <button
                          className="lookbackOption"
                          type="button"
                          key={option.value}
                          onClick={() => {
                            onLookbackChange(option.value);
                            onLookbackOpenChange(false);
                          }}
                        >
                          <span>{option.label}</span>
                          {isSelected && <img src={selectedIconUrl} alt="" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <p className="settingsHelper">
                Limits duplicate checks to recently indexed posts.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function getMatchBadgeClass(similarityScore: number) {
  if (similarityScore >= 90) {
    return 'matchBadge matchBadgeHigh';
  }

  if (similarityScore >= 50) {
    return 'matchBadge matchBadgeMedium';
  }

  return 'matchBadge matchBadgeLow';
}

type SuccessBannerProps = {
  message: string;
  isFading: boolean;
};

function SuccessBanner({ message, isFading }: SuccessBannerProps) {
  return (
    <div
      className={isFading ? 'successBanner successBannerFading' : 'successBanner'}
      role="status"
    >
      <img src={successIconUrl} alt="" />
      <span>{message}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="emptyState">
      <h2>No duplicates detected 🎉</h2>
      <p>ThreadScout will flag similar posts as they appear.</p>
    </div>
  );
}

type RemoveConfirmationProps = {
  isWorking: boolean;
  isPlural?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function RemoveConfirmation({
  isWorking,
  isPlural = false,
  onCancel,
  onConfirm,
}: RemoveConfirmationProps) {
  return (
    <div className="removeConfirmation">
      <img className="removeWarningIcon" src={warningIconUrl} alt="" />
      <h2>
        {isPlural
          ? 'Are you sure you want to remove these duplicates?'
          : 'Are you sure you want to remove this duplicate?'}
      </h2>
      <p>This is a permanent action that cannot be undone.</p>

      <button
        className="secondary ignoreAction"
        type="button"
        disabled={isWorking}
        onClick={onCancel}
      >
        Cancel
      </button>

      <button
        className="danger removeAction"
        type="button"
        disabled={isWorking}
        onClick={onConfirm}
      >
        {isWorking
          ? 'Working…'
          : isPlural
            ? 'Yes, remove duplicates'
            : 'Yes, remove duplicate'}
      </button>
    </div>
  );
}

type DuplicateDetailsProps = {
  item: DuplicateCase;
  isWorking: boolean;
  isConfirmingRemove: boolean;
  onBack: () => void;
  onAction: (id: string, action: CaseAction) => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
};

function DuplicateDetails({
  item,
  isWorking,
  isConfirmingRemove,
  onBack,
  onAction,
  onCancelRemove,
  onConfirmRemove,
}: DuplicateDetailsProps) {
  return (
    <section className="mobileDetailsView">
      <Header />

      <article className="detailsCard">
        {isConfirmingRemove ? (
          <RemoveConfirmation
            isWorking={isWorking}
            onCancel={onCancelRemove}
            onConfirm={onConfirmRemove}
          />
        ) : (
          <>
            <button className="detailsBackButton" type="button" onClick={onBack}>
              <img src={chevronIconUrl} alt="" />
              <span>Duplicate Post Details</span>
            </button>

            <h2 className="detailsDuplicateTitle">{item.duplicateTitle}</h2>
            <p className="detailsMeta">
              <span className="metaLabel">Possible duplicate of:</span>{' '}
              <span className="metaTitle">{item.originalTitle}</span>
            </p>

            {item.aiExplanation && (
              <div className="detailsAiExplanation">
                <p>🤖 {item.aiExplanation}</p>
              </div>
            )}

            <div className="detailsLinkRow">
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
                  View original post
                </a>
              )}
            </div>

            <div className="detailsActionRow actionRow">
              <button
                className="danger removeAction"
                disabled={isWorking}
                onClick={() => onAction(item.id, 'remove')}
              >
                {isWorking ? 'Working…' : 'Remove'}
              </button>

              <button
                className="secondary ignoreAction"
                disabled={isWorking}
                onClick={() => onAction(item.id, 'ignore')}
              >
                {isWorking ? 'Working…' : 'Ignore'}
              </button>

              <button
                className="commentAction"
                disabled={isWorking}
                onClick={() => onAction(item.id, 'comment-redirect')}
              >
                {isWorking ? 'Working…' : 'Comment as mod'}
              </button>
            </div>
          </>
        )}
      </article>
    </section>
  );
}

function App() {
  const [cases, setCases] = useState<DuplicateCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingCaseId, setWorkingCaseId] = useState<string | null>(null);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [settingsSensitivity, setSettingsSensitivity] =
    useState<Sensitivity>('medium');
  const [autoResponseEnabled, setAutoResponseEnabled] = useState(false);
  const [lookbackWindow, setLookbackWindow] = useState<LookbackWindow>('7d');
  const [lookbackOpen, setLookbackOpen] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [desktopPage, setDesktopPage] = useState(1);
  const [detailCaseId, setDetailCaseId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] =
    useState<RemoveConfirmationState | null>(null);
  const [showRemoveSuccess, setShowRemoveSuccess] = useState(false);
  const [isRemoveSuccessFading, setIsRemoveSuccessFading] = useState(false);
  const [lastRemoveCount, setLastRemoveCount] = useState(1);

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

  async function runAction(id: string, action: CaseAction) {
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

  function handleAction(id: string, action: CaseAction) {
    if (action === 'remove') {
      setShowRemoveSuccess(false);
      setIsRemoveSuccessFading(false);
      setPendingRemove({ kind: 'single', id });
      return;
    }

    runAction(id, action);
  }

  async function runSelectedAction(action: CaseAction) {
    if (selectedCaseIds.length === 0) {
      return;
    }

    setWorkingCaseId('selected');

    try {
      for (const id of selectedCaseIds) {
        const res = await fetch(`/api/cases/${id}/${action}`, {
          method: 'POST',
        });

        if (!res.ok) {
          console.error(`Action failed: ${action}`, await res.text());
        }
      }

      setSelectedCaseIds([]);
      await loadCases();
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
    } finally {
      setWorkingCaseId(null);
    }
  }

  function handleSelectedAction(action: CaseAction) {
    if (selectedCaseIds.length === 0) {
      return;
    }

    if (action === 'remove') {
      setShowRemoveSuccess(false);
      setIsRemoveSuccessFading(false);
      setPendingRemove({ kind: 'bulk', ids: [...selectedCaseIds] });
      return;
    }

    runSelectedAction(action);
  }

  async function confirmRemove() {
    if (!pendingRemove) {
      return;
    }

    const idsToRemove =
      pendingRemove.kind === 'single' ? [pendingRemove.id] : pendingRemove.ids;
    const workingId = pendingRemove.kind === 'single' ? pendingRemove.id : 'selected';
    let removedAny = false;

    setWorkingCaseId(workingId);

    try {
      for (const id of idsToRemove) {
        const res = await fetch(`/api/cases/${id}/remove`, {
          method: 'POST',
        });

        if (!res.ok) {
          console.error('Action failed: remove', await res.text());
        } else {
          removedAny = true;
        }
      }

      if (removedAny) {
        setLastRemoveCount(idsToRemove.length);
        setIsRemoveSuccessFading(false);
        setShowRemoveSuccess(true);
        setSelectedCaseIds((current) =>
          current.filter((id) => !idsToRemove.includes(id))
        );

        if (detailCaseId && idsToRemove.includes(detailCaseId)) {
          setDetailCaseId(null);
        }

        await loadCases();
      }
    } catch (error) {
      console.error('Failed to remove:', error);
    } finally {
      setPendingRemove(null);
      setWorkingCaseId(null);
    }
  }

  useEffect(() => {
    loadCases();
  }, []);

  useEffect(() => {
    if (!showRemoveSuccess) {
      return undefined;
    }

    const fadeTimer = window.setTimeout(() => {
      setIsRemoveSuccessFading(true);
    }, 4600);

    const hideTimer = window.setTimeout(() => {
      setShowRemoveSuccess(false);
      setIsRemoveSuccessFading(false);
    }, 5000);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [showRemoveSuccess]);

  const pendingCases = cases.filter((item) => item.status === 'pending');

  const averageSimilarity =
    pendingCases.length === 0
      ? 0
      : Math.round(
          pendingCases.reduce((sum, item) => sum + item.similarityScore, 0) /
            pendingCases.length
        );

  const desktopRowsPerPage = 4;
  const desktopPageCount = Math.max(
    1,
    Math.ceil(pendingCases.length / desktopRowsPerPage)
  );

  useEffect(() => {
    setDesktopPage((current) => Math.min(current, desktopPageCount));
  }, [desktopPageCount]);

  const desktopPageCases = pendingCases.slice(
    (desktopPage - 1) * desktopRowsPerPage,
    desktopPage * desktopRowsPerPage
  );

  const allVisibleCasesSelected =
    desktopPageCases.length > 0 &&
    desktopPageCases.every((item) => selectedCaseIds.includes(item.id));

  const selectedCount = selectedCaseIds.length;
  const selectedActionsDisabled = selectedCount === 0 || workingCaseId === 'selected';
  const detailCase = pendingCases.find((item) => item.id === detailCaseId);

  return (
    <main className={detailCase ? 'dashboard dashboardWithDetails' : 'dashboard'}>
      <section className="headerStatsArea">
        <div className="headerStatsTop">
          <Header />
          <StatsCards
            pendingCount={pendingCases.length}
            averageSimilarity={averageSimilarity}
          />
        </div>

        <SettingsCard
          expanded={settingsExpanded}
          sensitivity={settingsSensitivity}
          autoResponseEnabled={autoResponseEnabled}
          lookbackWindow={lookbackWindow}
          lookbackOpen={lookbackOpen}
          onToggleExpanded={() => {
            setSettingsExpanded((current) => !current);
          }}
          onSensitivityChange={setSettingsSensitivity}
          onAutoResponseChange={setAutoResponseEnabled}
          onLookbackChange={setLookbackWindow}
          onLookbackOpenChange={setLookbackOpen}
        />
      </section>

      {detailCase && (
        <DuplicateDetails
          item={detailCase}
          isWorking={workingCaseId === detailCase.id}
          isConfirmingRemove={
            pendingRemove?.kind === 'single' && pendingRemove.id === detailCase.id
          }
          onBack={() => {
            setDetailCaseId(null);
          }}
          onAction={handleAction}
          onCancelRemove={() => {
            setPendingRemove(null);
          }}
          onConfirmRemove={confirmRemove}
        />
      )}

      {showRemoveSuccess && (
        <SuccessBanner
          isFading={isRemoveSuccessFading}
          message={
            lastRemoveCount > 1
              ? 'Posts removed successfully'
              : 'Post removed successfully'
          }
        />
      )}

      <section
        className={
          !loading && pendingCases.length === 0
            ? 'desktopCaseGrid desktopCaseGridEmpty'
            : 'desktopCaseGrid'
        }
      >
        {loading ? (
          <div className="loadingState">Loading duplicate cases…</div>
        ) : pendingCases.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="desktopGridControls">
              <span className="desktopSelectedCount">
                {selectedCount > 0 ? `${selectedCount} selected` : ''}
              </span>

              <div className="desktopControlsRight">
                <label className="desktopSearchControl">
                  <img src={searchIconUrl} alt="" />
                  <span>Search</span>
                </label>

                <button className="desktopSortButton" type="button">
                  <span>Sort by</span>
                  <img src={chevronIconUrl} alt="" />
                </button>
              </div>
            </div>

            <table className="desktopCasesTable">
              <thead>
                <tr>
                  <th scope="col">
                    <label className="desktopCheckboxHeader">
                      <input
                        type="checkbox"
                        checked={allVisibleCasesSelected}
                        onChange={(event) => {
                          const visibleIds = desktopPageCases.map((item) => item.id);
                          setSelectedCaseIds(
                            event.target.checked
                              ? Array.from(
                                  new Set([...selectedCaseIds, ...visibleIds])
                                )
                              : selectedCaseIds.filter(
                                  (id) => !visibleIds.includes(id)
                                )
                          );
                        }}
                      />
                      <img
                        className="desktopCheckboxIcon"
                        src={
                          allVisibleCasesSelected
                            ? checkedIconUrl
                            : uncheckedIconUrl
                        }
                        alt=""
                      />
                      <span>Duplicate post</span>
                    </label>
                  </th>
                  <th scope="col">Original post</th>
                  <th scope="col">Match %</th>
                  <th scope="col">Explanation</th>
                </tr>
              </thead>

              <tbody>
                {desktopPageCases.map((item) => {
                  const similarityScore = Math.round(item.similarityScore);
                  const isSelected = selectedCaseIds.includes(item.id);

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="desktopDuplicateCell">
                          <label className="desktopCheckboxControl">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(event) => {
                                setSelectedCaseIds((current) =>
                                  event.target.checked
                                    ? [...current, item.id]
                                    : current.filter((id) => id !== item.id)
                                );
                              }}
                              aria-label={`Select ${item.duplicateTitle}`}
                            />
                            <img
                              className="desktopCheckboxIcon"
                              src={isSelected ? checkedIconUrl : uncheckedIconUrl}
                              alt=""
                            />
                          </label>
                          {item.duplicatePermalink ? (
                            <a
                              href={`https://www.reddit.com${item.duplicatePermalink}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {item.duplicateTitle}
                            </a>
                          ) : (
                            <span>{item.duplicateTitle}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {item.originalPermalink ? (
                          <a
                            href={`https://www.reddit.com${item.originalPermalink}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {item.originalTitle}
                          </a>
                        ) : (
                          <span>{item.originalTitle}</span>
                        )}
                      </td>
                      <td>
                        <span className={getMatchBadgeClass(similarityScore)}>
                          {similarityScore}% match
                        </span>
                      </td>
                      <td>
                        <p className="desktopExplanationText">
                          {item.aiExplanation ? `🤖 ${item.aiExplanation}` : ''}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="desktopGridFooter">
              <div className="desktopPagination">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={desktopPage === 1}
                  onClick={() => {
                    setDesktopPage((current) => Math.max(1, current - 1));
                  }}
                >
                  <img src={chevronIconUrl} alt="" />
                </button>
                <span>
                  Page {desktopPage} of {desktopPageCount}
                </span>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={desktopPage === desktopPageCount}
                  onClick={() => {
                    setDesktopPage((current) =>
                      Math.min(desktopPageCount, current + 1)
                    );
                  }}
                >
                  <img src={chevronIconUrl} alt="" />
                </button>
              </div>

              <div className="desktopBulkActions">
                <button
                  className="commentAction"
                  type="button"
                  disabled={selectedActionsDisabled}
                  onClick={() => handleSelectedAction('comment-redirect')}
                >
                  Comment as mod
                </button>
                <button
                  className="ignoreAction"
                  type="button"
                  disabled={selectedActionsDisabled}
                  onClick={() => handleSelectedAction('ignore')}
                >
                  Ignore
                </button>
                <button
                  className="removeAction"
                  type="button"
                  disabled={selectedActionsDisabled}
                  onClick={() => handleSelectedAction('remove')}
                >
                  Remove
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {pendingRemove && (
        <div className="desktopRemoveOverlay" role="dialog" aria-modal="true">
          <div className="desktopRemoveModal">
            <RemoveConfirmation
              isPlural={
                pendingRemove.kind === 'bulk' && pendingRemove.ids.length > 1
              }
              isWorking={
                pendingRemove.kind === 'bulk'
                  ? workingCaseId === 'selected'
                  : workingCaseId === pendingRemove.id
              }
              onCancel={() => {
                setPendingRemove(null);
              }}
              onConfirm={confirmRemove}
            />
          </div>
        </div>
      )}

      <section
        className={
          !loading && pendingCases.length === 0
            ? 'caseList caseListEmpty'
            : 'caseList'
        }
      >
        {loading ? (
          <div className="loadingState">Loading duplicate cases…</div>
        ) : pendingCases.length === 0 ? (
          <EmptyState />
        ) : (
          pendingCases.map((item) => {
            const isWorking = workingCaseId === item.id;
            const similarityScore = Math.round(item.similarityScore);
            const isConfirmingRemove =
              pendingRemove?.kind === 'single' && pendingRemove.id === item.id;

            return (
              <article
                className={
                  isConfirmingRemove
                    ? 'caseCard removeConfirmationCard'
                    : 'caseCard'
                }
                key={item.id}
              >
                {isConfirmingRemove ? (
                  <RemoveConfirmation
                    isWorking={isWorking}
                    onCancel={() => {
                      setPendingRemove(null);
                    }}
                    onConfirm={confirmRemove}
                  />
                ) : (
                  <>
                <div className="caseHeader">
                  <div>
                    <p className={getMatchBadgeClass(similarityScore)}>
                      {similarityScore}% match
                    </p>
                  </div>

                  {item.duplicatePermalink && (
                    <button
                      className="openPostLink"
                      type="button"
                      aria-label="Open duplicate post details"
                      onClick={() => {
                        setDetailCaseId(item.id);
                      }}
                    >
                      <img src={openIconUrl} alt="" />
                    </button>
                  )}
                </div>

                <h2 className="duplicateTitle">{item.duplicateTitle}</h2>
                <p className="meta">
                  <span className="metaLabel">Possible duplicate of:</span>{' '}
                  <span className="metaTitle">{item.originalTitle}</span>
                </p>

                {item.aiExplanation && (
                  <div className="aiExplanation">
                    <p className="aiExplanationText">🤖 {item.aiExplanation}</p>
                  </div>
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
                      <span className="desktopLinkText">View original</span>
                      <span className="mobileLinkText">View original post</span>
                    </a>
                  )}
                </div>

                <div className="actionRow">
                  <button
                    className="commentAction"
                    disabled={isWorking}
                    onClick={() => handleAction(item.id, 'comment-redirect')}
                  >
                    {isWorking ? (
                      'Working…'
                    ) : (
                      <>
                        <span className="desktopButtonText">Comment + Redirect</span>
                        <span className="mobileButtonText">Comment as mod</span>
                      </>
                    )}
                  </button>

                  <button
                    className="danger removeAction"
                    disabled={isWorking}
                    onClick={() => handleAction(item.id, 'remove')}
                  >
                    {isWorking ? (
                      'Working…'
                    ) : (
                      <>
                        <span className="desktopButtonText">Remove Duplicate</span>
                        <span className="mobileButtonText">Remove</span>
                      </>
                    )}
                  </button>

                  <button
                    className="secondary ignoreAction"
                    disabled={isWorking}
                    onClick={() => handleAction(item.id, 'ignore')}
                  >
                    {isWorking ? 'Working…' : 'Ignore'}
                  </button>
                </div>
                  </>
                )}
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

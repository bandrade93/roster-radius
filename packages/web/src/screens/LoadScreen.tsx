import { useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router';
import { STATE_LAWS, type StateCode } from '@roster-radius/core';
import contractsExample from '../../../../docs/formats/contracts-example.csv?url';
import declaredExample from '../../../../docs/formats/declared-example.csv?url';
import inventoryTemplate from '../../../../docs/formats/inventory-template.csv?url';
import { useAnalysis } from '../app/AnalysisContext';
import { EMPTY, forSlot, fromFolder, localToday, merge, missing, withoutSlot, type FileSet, type Slot } from '../app/districtFiles';
import { filesFromDrop, filesFromFolderInput } from '../app/drop';
import { Button } from '../components/Button';
import { FileSlot } from '../components/FileSlot';
import styles from './LoadScreen.module.css';

const REPOSITORY = 'https://github.com/bandrade93/roster-radius/blob/main';
// Not in React's types, but supported by every current browser.
const FOLDER_PICKER = { webkitdirectory: '' };
const STATES = Object.entries(STATE_LAWS) as [StateCode, { readonly name: string }][];

export function LoadScreen() {
  const { client, setReport, stateCode, setStateCode } = useAnalysis();
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileSet>(EMPTY);
  const [today, setToday] = useState(localToday);
  const [dragging, setDragging] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string>();

  const loadedIn = (slot: Slot) => files.files.filter((f) => f.slot === slot).map((f) => f.name);
  const choose = (slot: Slot) => (chosen: File[]) => setFiles((set) => merge(slot === 'oneroster' || slot === 'vendorFiles' ? set : withoutSlot(set, slot), { files: forSlot(slot, chosen), ignored: [] }));
  const clear = (slot: Slot) => () => setFiles((set) => withoutSlot(set, slot));
  const absent = missing(files);

  const run = async (request: Parameters<typeof client.request>[0]) => {
    setWorking(true);
    setError(undefined);

    const answer = await client.request(request);
    setWorking(false);

    if (!answer.ok) {
      setError(answer.error);
      return;
    }

    if ('report' in answer) {
      setReport(answer.report);
      navigate(request.type === 'sample' ? '/overview' : '/check');
    }
  };

  const onDrop = async (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);

    const sorted = await fromFolder(await filesFromDrop(event.dataTransfer));
    setFiles((set) => merge(set, sorted));
  };

  return (
    <div className={styles.layout}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Free and open source · v0.1</p>
        <h1 className={styles.title}>Which vendors receive your students' data?</h1>
        <p className={styles.lead}>
          Load the files your district already has. RosterRadius shows which vendors receive which student data, how many students each would expose in a breach, and whether that matches your contracts.
        </p>
        <div className={styles.privacy}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <div>
            <p className={styles.privacyTitle}>Runs entirely on this computer</p>
            <p>Files are read in your browser and never uploaded. Student identifiers are used in memory to count students, and are gone when you close the page.</p>
          </div>
        </div>
        <div className={styles.row}>
          <Button variant="secondary" onClick={() => run({ type: 'sample' })} disabled={working}>
            Try with a sample district
          </Button>
          <a href={`${REPOSITORY}/METHODOLOGY.md`} target="_blank" rel="noreferrer">
            Read the methodology
          </a>
        </div>
        <label className={styles.field}>
          Your state
          <select value={stateCode ?? ''} onChange={(e) => setStateCode((e.target.value || undefined) as StateCode | undefined)}>
            {STATES.map(([code, law]) => (
              <option key={code} value={code}>
                {law.name}
              </option>
            ))}
            <option value="">Another state (federal rules only)</option>
          </select>
        </label>
      </div>

      <form
        className={styles.files}
        onSubmit={(e) => {
          e.preventDefault();
          void run({ type: 'analyze', files: files.files.map(({ path, content }) => ({ path, content })), today });
        }}
      >
        <div
          className={`${styles.drop} ${dragging ? styles.dragging : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <p className={styles.dropTitle}>Load your district folder</p>
          <p className={styles.dropText}>Drop the folder or its files here, or choose the folder. Each file goes to its place below.</p>
          <label className={styles.folderButton}>
            Choose folder
            <input
              className="visually-hidden"
              type="file"
              {...FOLDER_PICKER}
              onChange={async (e) => {
                const list = e.target.files;
                if (!list) return;

                const sorted = await fromFolder(filesFromFolderInput(list));
                e.target.value = '';
                setFiles((set) => merge(set, sorted));
              }}
            />
          </label>
        </div>

        <FileSlot
          title="OneRoster export"
          required
          description="Your roster, exported from your student information system or rostering hub. Used to count students and staff by school and grade."
          hint="A .zip, or orgs.csv and users.csv. Other files, like demographics.csv, are never opened."
          accept=".zip,.csv"
          multiple
          loaded={loadedIn('oneroster')}
          onChoose={choose('oneroster')}
          onClear={clear('oneroster')}
        />
        <FileSlot
          title="App inventory"
          required
          description="One row per app and channel: who receives which fields, for which students."
          hint={
            <>
              <a href={inventoryTemplate} download="inventory.csv">
                Download the template
              </a>{' '}
              ·{' '}
              <a href={`${REPOSITORY}/docs/formats/inventory.md`} target="_blank" rel="noreferrer">
                How to fill it in
              </a>
            </>
          }
          accept=".csv"
          loaded={loadedIn('inventory')}
          onChoose={choose('inventory')}
          onClear={clear('inventory')}
        />
        <FileSlot
          title="Contracts"
          description="Your data privacy agreements: the Exhibit B categories each one allows and when it ends."
          hint={
            <a href={contractsExample} download="contracts.csv">
              Download an example
            </a>
          }
          accept=".csv"
          loaded={loadedIn('contracts')}
          onChoose={choose('contracts')}
          onClear={clear('contracts')}
        />
        <FileSlot
          title="Published list"
          description="What your district published about the vendors that receive student data, to compare it with what flows."
          hint={
            <a href={declaredExample} download="declared.csv">
              Download an example
            </a>
          }
          accept=".csv"
          loaded={loadedIn('declared')}
          onChoose={choose('declared')}
          onClear={clear('declared')}
        />
        <FileSlot
          title="Files named in the inventory"
          description="Clever “Application Receives” files and the exports you send to vendors. Fields read from them are reported as measured."
          hint="Found by name. If two files have the same name, load the whole folder instead."
          accept=".csv"
          multiple
          loaded={loadedIn('vendorFiles')}
          onChoose={choose('vendorFiles')}
          onClear={clear('vendorFiles')}
        />

        {files.ignored.length > 0 && <p className={styles.note}>Not used, because they are not CSV or zip files: {files.ignored.join(', ')}.</p>}

        <div className={styles.submit}>
          <label className={styles.field}>
            Results for
            <input type="date" value={today} required onChange={(e) => setToday(e.target.value)} />
          </label>
          <Button type="submit" disabled={working || absent.length > 0}>
            Check files
          </Button>
        </div>
        <div role="status" aria-live="polite" className={styles.status}>
          {absent.length > 0 && <p>Still needed: {absent.join(' and ')}.</p>}
          {working && <p>Reading the files…</p>}
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </form>
    </div>
  );
}

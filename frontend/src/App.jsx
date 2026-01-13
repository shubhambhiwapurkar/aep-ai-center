import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Shell from './components/Shell';
import Dashboard from './pages/Dashboard';
import BatchMonitor from './pages/BatchMonitor';
import SchemaBrowser from './pages/SchemaBrowser';
import Datasets from './pages/Datasets';
import Identities from './pages/Identities';
import Queries from './pages/Queries';
import Profiles from './pages/Profiles';
import Flows from './pages/Flows';
import Segments from './pages/Segments';
import APIBrowser from './pages/APIBrowser';
import Policies from './pages/Policies';
import AuditLog from './pages/AuditLog';
import Privacy from './pages/Privacy';
import Observability from './pages/Observability';
import Sandboxes from './pages/Sandboxes';
import SandboxCompare from './pages/SandboxCompare';
import DataIngestion from './pages/DataIngestion';
import DataPrep from './pages/DataPrep';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/batches" element={<BatchMonitor />} />
          <Route path="/schemas" element={<SchemaBrowser />} />
          <Route path="/datasets" element={<Datasets />} />
          <Route path="/identities" element={<Identities />} />
          <Route path="/profiles" element={<Profiles />} />
          <Route path="/flows" element={<Flows />} />
          <Route path="/segments" element={<Segments />} />
          <Route path="/queries" element={<Queries />} />
          <Route path="/policies" element={<Policies />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/observability" element={<Observability />} />
          <Route path="/sandboxes" element={<Sandboxes />} />
          <Route path="/sandbox-compare" element={<SandboxCompare />} />
          <Route path="/ingestion" element={<DataIngestion />} />
          <Route path="/data-prep" element={<DataPrep />} />
          <Route path="/api-browser" element={<APIBrowser />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}

export default App;



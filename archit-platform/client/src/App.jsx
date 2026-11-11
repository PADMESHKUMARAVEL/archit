import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { Login,Register } from './pages/Auth';
import Feed from './pages/Feed';
import Network from './pages/Network';
import Jobs from './pages/Jobs';
import Discover from './pages/Discover';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
import ClientDashboard from './pages/ClientDashboard';
import ClientArchitects, { ClientArchitectProfile } from './pages/ClientArchitects';
import ClientEnquiries from './pages/ClientEnquiries';
import ClientProjects from './pages/ClientProjects';
import ClientSettings from './pages/ClientSettings';
import ClientDocuments from './pages/ClientDocuments';
import Notifications from './pages/Notifications';
import ProjectBoard from './pages/ProjectBoard';
import { useAuth } from './context/AuthContext';

function PrivateLayout() { return <ProtectedRoute><Layout /></ProtectedRoute>; }
function HomePage() { const {user} = useAuth(); return user?.role === 'CLIENT' ? <ClientDashboard/> : <Feed/>; }
function DiscoverPage() { const {user} = useAuth(); return user?.role === 'CLIENT' ? <ClientArchitects/> : <Discover/>; }
function ProfilePage() { const {user} = useAuth(); return user?.role === 'CLIENT' ? <ClientSettings/> : <Profile/>; }
export default function App() {
  return <AuthProvider><BrowserRouter><Routes>
    <Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/>
    <Route element={<PrivateLayout/>}>
      <Route index element={<HomePage/>}/>
      <Route path="/network" element={<Network/>}/>
      <Route path="/jobs" element={<Jobs/>}/>
      <Route path="/discover" element={<DiscoverPage/>}/>
      <Route path="/saved" element={<ProtectedRoute roles={['CLIENT']}><ClientArchitects savedOnly/></ProtectedRoute>}/>
      <Route path="/project-requests" element={<ProtectedRoute roles={['CLIENT']}><ProjectBoard clientMode/></ProtectedRoute>}/>
      <Route path="/project-requests/:id" element={<ProtectedRoute roles={['CLIENT']}><ProjectBoard clientMode/></ProtectedRoute>}/>
      <Route path="/project-board" element={<ProtectedRoute roles={['ARCHITECT']}><ProjectBoard/></ProtectedRoute>}/>
      <Route path="/project-board/:id" element={<ProtectedRoute roles={['ARCHITECT']}><ProjectBoard/></ProtectedRoute>}/>
      <Route path="/architects/:id" element={<ProtectedRoute roles={['CLIENT']}><ClientArchitectProfile/></ProtectedRoute>}/>
      <Route path="/enquiries" element={<ProtectedRoute roles={['CLIENT','ARCHITECT']}><ClientEnquiries/></ProtectedRoute>}/>
      <Route path="/enquiries/:id" element={<ProtectedRoute roles={['CLIENT','ARCHITECT']}><ClientEnquiries/></ProtectedRoute>}/>
      <Route path="/projects" element={<ProtectedRoute roles={['CLIENT','ARCHITECT']}><ClientProjects/></ProtectedRoute>}/>
      <Route path="/projects/:id" element={<ProtectedRoute roles={['CLIENT','ARCHITECT']}><ClientProjects/></ProtectedRoute>}/>
      <Route path="/documents" element={<ProtectedRoute roles={['CLIENT','ARCHITECT']}><ClientDocuments/></ProtectedRoute>}/>
      <Route path="/notifications" element={<Notifications/>}/>
      <Route path="/messages" element={<Messages/>}/>
      <Route path="/profile" element={<ProfilePage/>}/>
      <Route path="/users/:id" element={<UserProfile/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></BrowserRouter></AuthProvider>;
}

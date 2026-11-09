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

function PrivateLayout() { return <ProtectedRoute><Layout /></ProtectedRoute>; }
export default function App() {
  return <AuthProvider><BrowserRouter><Routes>
    <Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/>
    <Route element={<PrivateLayout/>}>
      <Route index element={<Feed/>}/>
      <Route path="/network" element={<Network/>}/>
      <Route path="/jobs" element={<Jobs/>}/>
      <Route path="/discover" element={<Discover/>}/>
      <Route path="/messages" element={<Messages/>}/>
      <Route path="/profile" element={<Profile/>}/>
      <Route path="/users/:id" element={<UserProfile/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></BrowserRouter></AuthProvider>;
}

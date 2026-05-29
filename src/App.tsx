import { Routes, Route } from 'react-router-dom';
import './App.css';
import MainLayout from './Component/MainLayout';
import Home from './pages/Home';
import Project from './pages/Project';
import { AuthGuard } from './auth/AuthGuard';

function App() {
    return (
        <AuthGuard>
            <Routes>
                <Route element={<MainLayout />}>
                    <Route index element={<Home />} />
                    <Route path="/project" element={<Project />} />
                </Route>
            </Routes>
        </AuthGuard>
    );
}

export default App;

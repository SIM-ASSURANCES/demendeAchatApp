import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./lib/auth";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicFormPage } from "./pages/PublicFormPage";
import { SuiviEntryPage } from "./pages/SuiviEntryPage";
import { SuiviPage } from "./pages/SuiviPage";
import { LoginPage } from "./pages/LoginPage";
import { ListePage } from "./pages/rh-dg/ListePage";
import { DetailPage } from "./pages/rh-dg/DetailPage";
import { AdminPage } from "./pages/admin/AdminPage";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<PublicFormPage />} />
              <Route path="/suivi" element={<SuiviEntryPage />} />
              <Route path="/suivi/:token" element={<SuiviPage />} />
              <Route path="/connexion" element={<LoginPage />} />

              <Route element={<ProtectedRoute rolesAutorises={["RH", "DG", "ADMIN"]} />}>
                <Route path="/espace/demandes" element={<ListePage />} />
                <Route path="/espace/demandes/:id" element={<DetailPage />} />
              </Route>

              <Route element={<ProtectedRoute rolesAutorises={["ADMIN"]} />}>
                <Route path="/admin" element={<AdminPage />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

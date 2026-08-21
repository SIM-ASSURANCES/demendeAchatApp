import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./lib/auth";
import { Layout } from "./components/Layout";
import { PrivateLayout } from "./components/PrivateLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicFormPage } from "./pages/PublicFormPage";
import { SuiviEntryPage } from "./pages/SuiviEntryPage";
import { SuiviPage } from "./pages/SuiviPage";
import { VerificationPage } from "./pages/VerificationPage";
import { LoginPage } from "./pages/LoginPage";
import { ListePage } from "./pages/rh-dg/ListePage";
import { DetailPage } from "./pages/rh-dg/DetailPage";
import { RapportsPage } from "./pages/rh-dg/RapportsPage";
import { BudgetsPage } from "./pages/rh-dg/BudgetsPage";
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
              <Route path="/verification/:numero" element={<VerificationPage />} />
              <Route path="/connexion" element={<LoginPage />} />
            </Route>

            <Route element={<ProtectedRoute rolesAutorises={["RH", "DG", "ADMIN"]} />}>
              <Route element={<PrivateLayout />}>
                <Route path="/espace/demandes" element={<ListePage />} />
                <Route path="/espace/demandes/:id" element={<DetailPage />} />
                <Route path="/espace/rapports" element={<RapportsPage />} />
                <Route path="/espace/budgets" element={<BudgetsPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute rolesAutorises={["ADMIN"]} />}>
              <Route element={<PrivateLayout />}>
                <Route path="/admin" element={<AdminPage />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

import { Suspense } from "react";

import { BilingualCopy } from "../auth/bilingual-copy";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="authPage">
      <Suspense
        fallback={
          <section className="authPanel">
            <p className="formMessage">
              <BilingualCopy messageKey="authRedirecting" />
            </p>
          </section>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}

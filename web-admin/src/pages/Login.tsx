import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Button } from 'src/components/ui/Button';
import { Field, Input } from 'src/components/ui/Field';
import { useAuthStore } from 'src/stores/authStore';
import { radius, shadow } from 'src/theme/tokens';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function Login() {
  const navigate = useNavigate();
  const status = useAuthStore(state => state.status);
  const error = useAuthStore(state => state.error);
  const login = useAuthStore(state => state.login);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginForm) {
    try {
      await login(values.email, values.password);
      navigate('/', { replace: true });
    } catch {
      // error surfaced from the store
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'var(--primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 20,
            }}
          >
            S
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>SheCare Admin</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Content &amp; operations console</div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="card"
          style={{ boxShadow: shadow.md, borderRadius: radius.xl }}
          noValidate
        >
          <h1 style={{ fontSize: 20, marginBottom: 4 }}>Sign in</h1>
          <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: 13 }}>
            Use your SheCare admin account.
          </p>

          {error && (
            <div
              role="alert"
              style={{
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
                padding: '10px 12px',
                borderRadius: radius.md,
                marginBottom: 16,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <Field label="Email" error={errors.email?.message}>
            <Input
              type="email"
              autoComplete="email"
              placeholder="admin@shecare.app"
              invalid={!!errors.email}
              {...register('email')}
            />
          </Field>

          <Field label="Password" error={errors.password?.message}>
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              invalid={!!errors.password}
              {...register('password')}
            />
          </Field>

          <Button
            type="submit"
            disabled={status === 'loading'}
            loading={isSubmitting || status === 'loading'}
            className="btn-block"
          >
            Sign in
          </Button>

          <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            Need an account? Contact a SheCare administrator.
          </p>
        </form>
      </div>
    </div>
  );
}

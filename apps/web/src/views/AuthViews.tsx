'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { CoinIcon } from '@/components/Coin';
import { useToast } from '@/components/Toaster';
import { Alert, Button, Card, Field, Input } from '@/components/ui';
import { errorMessage, validationErrors } from '@/lib/api';
import { safeNextPath } from '@/lib/navigation';
import { useLogin, useRegister } from '@/lib/queries';

const DEMO_ACCOUNTS = [
  { label: 'Demo player', email: 'demo@coinvault.dev', password: 'Demo123!' },
  { label: 'Admin', email: 'admin@coinvault.dev', password: 'Admin123!' },
];

function AuthCard({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 text-center">
        <CoinIcon className="mx-auto size-12" />
        <h1 className="mt-4 text-2xl font-bold text-white">{title}</h1>
        <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
      </div>
      <Card className="p-6">{children}</Card>
    </div>
  );
}

export function LoginView() {
  const router = useRouter();
  const toast = useToast();
  const login = useLogin();
  const [form, setForm] = useState({ email: '', password: '' });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(form, {
      onSuccess: ({ user }) => {
        toast(`Welcome back, ${user.name}!`);
        router.push(safeNextPath(window.location.search));
      },
    });
  };
  const errors = validationErrors(login.error);

  return (
    <AuthCard
      title="Sign in to Coin Vault"
      subtitle={
        <>
          New here?{' '}
          <Link href="/register" className="font-semibold text-amber-300 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" error={errors.email}>
          <Input
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Password" error={errors.password}>
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        {login.isError && !Object.keys(errors).length && <Alert>{errorMessage(login.error)}</Alert>}
        <Button type="submit" className="w-full" loading={login.isPending}>
          Sign in
        </Button>
      </form>
      <div className="mt-6 border-t border-zinc-800 pt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Demo accounts (after seeding)</p>
        <div className="flex gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <Button
              key={account.email}
              type="button"
              variant="secondary"
              className="flex-1 text-xs"
              onClick={() => setForm({ email: account.email, password: account.password })}
            >
              {account.label}
            </Button>
          ))}
        </div>
      </div>
    </AuthCard>
  );
}

export function RegisterView() {
  const router = useRouter();
  const toast = useToast();
  const register = useRegister();
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    register.mutate(form, {
      onSuccess: ({ user }) => {
        toast(`Welcome, ${user.name}! Grab some Gold Coins to get started.`);
        router.push('/coins');
      },
    });
  };
  const errors = validationErrors(register.error);

  return (
    <AuthCard
      title="Create your account"
      subtitle={
        <>
          Already have one?{' '}
          <Link href="/login" className="font-semibold text-amber-300 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Display name" error={errors.name}>
          <Input
            autoComplete="nickname"
            required
            maxLength={80}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Password" error={errors.password}>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        {register.isError && !Object.keys(errors).length && <Alert>{errorMessage(register.error)}</Alert>}
        <Button type="submit" className="w-full" loading={register.isPending}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}

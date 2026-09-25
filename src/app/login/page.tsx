"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LockKeyhole } from "lucide-react";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div className="rounded-full bg-primary/10 p-4">
              <LockKeyhole className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Job Aggregator
          </CardTitle>
          <CardDescription className="text-base">
            Enter the password to access your job listings dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter passowrd"
                required
                className="h-11"
              />
              {state?.error && (
                <p className="text-sm font-medium text-destructive mt-2 text-center">
                  {state.error}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold"
              disabled={isPending}
            >
              {isPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

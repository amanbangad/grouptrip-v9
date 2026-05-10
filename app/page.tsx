"use client";

import { useState, useEffect, useActionState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getTrips,
  createTrip,
  deleteTrip,
  verifyPassword,
  checkAuth,
  logout,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import {
  MapPin,
  Calendar,
  Users,
  MessageCircle,
  Plus,
  Trash2,
  Lock,
  ArrowRight,
  Plane,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

interface Trip {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  createdAt: Date;
  _count: {
    participants: number;
    comments: number;
  };
}

export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();

  const [loginState, loginAction, loginPending] = useActionState(
    verifyPassword,
    null as boolean | null
  );

  const loadTrips = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTrips();
      setTrips(data as Trip[]);
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await checkAuth();
      if (cancelled) return;
      if (ok) {
        setAuthenticated(true);
        await loadTrips();
      } else {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTrips]);

  useEffect(() => {
    if (loginState === true) {
      setAuthenticated(true);
      loadTrips();
      toast.success("Welcome back!");
    } else if (loginState === false) {
      toast.error("Wrong password. Try again.");
    }
  }, [loginState, loadTrips]);

  async function handleLogout() {
    await logout();
    setAuthenticated(false);
    setTrips([]);
    toast.success("Signed out");
  }

  async function handleCreateTrip(formData: FormData) {
    await createTrip(formData);
    setDialogOpen(false);
    toast.success("Trip created!");
    loadTrips();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this trip?")) return;
    await deleteTrip(id);
    toast.success("Trip deleted");
    loadTrips();
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
              <Plane className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              GroupTrip
            </h1>
            <p className="text-muted-foreground">
              Plan trips together with friends
            </p>
          </div>

          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <form action={loginAction} className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 mb-4">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Enter the shared password to continue
                  </span>
                </div>

                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="Enter password..."
                      required
                      autoFocus
                    />
                  </Field>
                </FieldGroup>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={loginPending}
                >
                  {loginPending ? "Checking..." : "Enter"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plane className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">GroupTrip</h1>
              <p className="text-xs text-muted-foreground">Plan together</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleLogout}
            className="gap-2"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Trip</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Create a New Trip
                </DialogTitle>
              </DialogHeader>
              <form action={handleCreateTrip} className="space-y-4 mt-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="name">Trip Name</FieldLabel>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Beach Weekend, Ski Trip..."
                      required
                    />
                  </Field>
                </FieldGroup>

                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="description">
                      Description (optional)
                    </FieldLabel>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="What are we planning?"
                      rows={3}
                    />
                  </Field>
                </FieldGroup>

                <div className="grid grid-cols-2 gap-4">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="startDate">Start Date</FieldLabel>
                      <Input
                        id="startDate"
                        name="startDate"
                        type="date"
                        required
                      />
                    </Field>
                  </FieldGroup>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="endDate">End Date</FieldLabel>
                      <Input
                        id="endDate"
                        name="endDate"
                        type="date"
                        required
                      />
                    </Field>
                  </FieldGroup>
                </div>

                <Button type="submit" className="w-full" size="lg">
                  Create Trip
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading trips...</p>
            </div>
          </div>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-6">
              <MapPin className="w-10 h-10 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No trips yet
            </h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Create your first trip and start coordinating schedules with your
              friends.
            </p>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Your First Trip
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <Card
                key={trip.id}
                className="group cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1 overflow-hidden"
                onClick={() => router.push(`/trip/${trip.id}`)}
              >
                <div className="h-2 bg-gradient-to-r from-primary to-accent" />
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {trip.name}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(trip.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {trip.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {trip.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge
                      variant="secondary"
                      className="gap-1.5 font-normal"
                    >
                      <Users className="w-3 h-3" />
                      {trip._count.participants}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="gap-1.5 font-normal"
                    >
                      <MessageCircle className="w-3 h-3" />
                      {trip._count.comments}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

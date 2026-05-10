"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useRouter, useParams } from "next/navigation";
import { getTrip, saveAvailability, addComment } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  MessageCircle,
  Send,
  Star,
  Reply,
  User,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface Availability {
  id: string;
  participantId: string;
  tripId: string;
  date: string;
  slots: number[];
}

interface Participant {
  id: string;
  name: string;
  tripId: string;
  availabilities: Availability[];
}

interface CommentReply {
  id: string;
  tripId: string;
  author: string;
  content: string;
  parentId: string | null;
  createdAt: Date;
}

interface Comment {
  id: string;
  tripId: string;
  author: string;
  content: string;
  parentId: string | null;
  createdAt: Date;
  replies: CommentReply[];
}

interface Trip {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  participants: Participant[];
  comments: Comment[];
}

const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => i);
const SLOT_LABELS = TIME_SLOTS.map((h) => {
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}${ampm}`;
});

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  let curr = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (curr <= last) {
    dates.push(curr.toISOString().split("T")[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function TripPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [participantName, setParticipantName] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<Record<string, number[]>>(
    {}
  );
  const [saving, setSaving] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [commentAuthor, setCommentAuthor] = useState("");

  const loadTrip = useCallback(async () => {
    const data = await getTrip(tripId);
    setTrip(data as unknown as Trip);
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  useEffect(() => {
    if (trip && participantName) {
      const participant = trip.participants.find(
        (p) => p.name === participantName
      );
      if (participant) {
        const loaded: Record<string, number[]> = {};
        for (const a of participant.availabilities) {
          loaded[a.date] = a.slots;
        }
        setSelectedSlots(loaded);
      } else {
        setSelectedSlots({});
      }
    }
  }, [participantName, trip]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading trip...</p>
        </div>
      </main>
    );
  }

  if (!trip) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Trip not found</h2>
          <Button variant="outline" onClick={() => router.push("/")}>
            Go back home
          </Button>
        </div>
      </main>
    );
  }

  const dates = getDatesInRange(trip.startDate, trip.endDate);

  function toggleSlot(date: string, slot: number) {
    setSelectedSlots((prev) => {
      const current = prev[date] || [];
      if (current.includes(slot)) {
        return { ...prev, [date]: current.filter((s) => s !== slot) };
      }
      return { ...prev, [date]: [...current, slot].sort((a, b) => a - b) };
    });
  }

  async function handleSave() {
    if (!participantName.trim()) {
      toast.error("Enter your name first");
      return;
    }
    setSaving(true);
    for (const [date, slots] of Object.entries(selectedSlots)) {
      await saveAvailability(tripId, participantName, date, slots);
    }
    setSaving(false);
    toast.success("Availability saved!");
    loadTrip();
  }

  function getHeatmap(t: Trip, date: string, slot: number): number {
    let count = 0;
    for (const p of t.participants) {
      const a = p.availabilities.find((av) => av.date === date);
      if (a && a.slots.includes(slot)) count++;
    }
    return count;
  }

  function getBestTimes(t: Trip, datesList: string[]) {
    const results: { date: string; slot: number; count: number }[] = [];
    for (const date of datesList) {
      for (const slot of TIME_SLOTS) {
        const count = getHeatmap(t, date, slot);
        if (count > 0) results.push({ date, slot, count });
      }
    }
    return results.sort((a, b) => b.count - a.count).slice(0, 5);
  }

  async function handleAddComment() {
    if (!commentAuthor.trim() || !commentText.trim()) {
      toast.error("Enter your name and comment");
      return;
    }
    await addComment(tripId, commentAuthor, commentText, replyTo);
    setCommentText("");
    setReplyTo(null);
    toast.success("Comment posted!");
    loadTrip();
  }

  const bestTimes = getBestTimes(trip!, dates);

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="mb-3 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to trips
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {trip.name}
              </h1>
              {trip.description && (
                <p className="text-muted-foreground mt-1">{trip.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg">
              <Calendar className="w-4 h-4" />
              <span>
                {formatDateShort(trip.startDate)} —{" "}
                {formatDateShort(trip.endDate)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <Tabs defaultValue="availability" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="availability" className="gap-2">
              <Clock className="w-4 h-4" />
              Availability
            </TabsTrigger>
            <TabsTrigger value="discussion" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              Discussion
            </TabsTrigger>
          </TabsList>

          <TabsContent value="availability" className="space-y-6">
            {/* Name Input & Best Times */}
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    Your Availability
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <FieldGroup className="flex-1">
                      <Field>
                        <FieldLabel htmlFor="name">Your Name</FieldLabel>
                        <Input
                          id="name"
                          placeholder="Enter your name..."
                          value={participantName}
                          onChange={(e) => setParticipantName(e.target.value)}
                        />
                      </Field>
                    </FieldGroup>
                    <div className="flex items-end">
                      <Button
                        onClick={handleSave}
                        disabled={saving || !participantName.trim()}
                        className="gap-2"
                      >
                        {saving ? (
                          <>Saving...</>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Save
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {bestTimes.length > 0 && (
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Star className="w-5 h-5 text-primary" />
                      Best Times
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {bestTimes.map((bt, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">
                              {formatDateShort(bt.date)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {SLOT_LABELS[bt.slot]}
                            </span>
                          </div>
                          <Badge
                            variant="secondary"
                            className="gap-1 font-normal"
                          >
                            <Users className="w-3 h-3" />
                            {bt.count}/{trip.participants.length}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-primary" />
                <span className="text-muted-foreground">Your selection</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-accent/30 border border-accent" />
                <span className="text-muted-foreground">Group overlap</span>
              </div>
            </div>

            {/* Availability Grid */}
            <Card>
              <CardContent className="pt-6 overflow-x-auto">
                <div className="min-w-[640px]">
                  <div
                    className="grid gap-1"
                    style={{
                      gridTemplateColumns: `80px repeat(${dates.length}, minmax(80px, 1fr))`,
                    }}
                  >
                    {/* Header Row */}
                    <div className="sticky left-0 bg-card z-10 font-medium text-sm text-muted-foreground p-2">
                      Time
                    </div>
                    {dates.map((date) => (
                      <div
                        key={date}
                        className="font-medium text-sm text-center p-2 bg-muted/30 rounded-lg"
                      >
                        {formatDateLabel(date)}
                      </div>
                    ))}

                    {/* Time Slots */}
                    {TIME_SLOTS.filter((s) => s >= 6 && s <= 23).map((slot) => (
                      <Fragment key={`row-${slot}`}>
                        <div
                          key={`label-${slot}`}
                          className="sticky left-0 bg-card z-10 text-xs text-muted-foreground p-2 flex items-center"
                        >
                          {SLOT_LABELS[slot]}
                        </div>
                        {dates.map((date) => {
                          const isSelected =
                            selectedSlots[date]?.includes(slot);
                          const heatCount = getHeatmap(trip!, date, slot);
                          const totalParticipants = trip.participants.length;
                          const heatOpacity =
                            totalParticipants > 0
                              ? Math.min(heatCount / totalParticipants, 1)
                              : 0;

                          return (
                            <button
                              key={`${date}-${slot}`}
                              onClick={() => toggleSlot(date, slot)}
                              className={`relative h-10 rounded-lg text-xs font-medium transition-all ${
                                isSelected
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : "bg-muted/30 hover:bg-muted text-muted-foreground"
                              }`}
                            >
                              {heatCount > 0 && !isSelected && (
                                <div
                                  className="absolute inset-0 rounded-lg bg-accent/40"
                                  style={{ opacity: heatOpacity }}
                                />
                              )}
                              {heatCount > 0 && (
                                <span className="relative z-10">
                                  {heatCount}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Participants */}
            {trip.participants.length > 0 && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Participants ({trip.participants.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {trip.participants.map((p) => (
                      <Badge
                        key={p.id}
                        variant="secondary"
                        className="px-3 py-1.5"
                      >
                        {p.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="discussion" className="space-y-6">
            {/* Comment Form */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  {replyTo ? "Reply to Comment" : "Add a Comment"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {replyTo && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      Replying to a comment
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReplyTo(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}

                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="author">Your Name</FieldLabel>
                    <Input
                      id="author"
                      placeholder="Enter your name..."
                      value={commentAuthor}
                      onChange={(e) => setCommentAuthor(e.target.value)}
                    />
                  </Field>
                </FieldGroup>

                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="comment">Comment</FieldLabel>
                    <Textarea
                      id="comment"
                      placeholder="Share your thoughts..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      rows={3}
                    />
                  </Field>
                </FieldGroup>

                <Button onClick={handleAddComment} className="gap-2">
                  <Send className="w-4 h-4" />
                  Post Comment
                </Button>
              </CardContent>
            </Card>

            {/* Comments List */}
            {trip.comments.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">
                  No comments yet. Start the discussion!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {trip.comments.map((comment) => (
                  <CommentThread
                    key={comment.id}
                    comment={comment}
                    onReply={(id) => {
                      setReplyTo(id);
                      setCommentAuthor(commentAuthor || "");
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function CommentThread({
  comment,
  onReply,
}: {
  comment: Comment;
  onReply: (id: string) => void;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-medium text-primary">
              {comment.author.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-foreground">
                {comment.author}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(comment.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-foreground/90 mb-3">{comment.content}</p>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 -ml-2"
              onClick={() => onReply(comment.id)}
            >
              <Reply className="w-4 h-4" />
              Reply
            </Button>

            {comment.replies.length > 0 && (
              <div className="mt-4 space-y-4 pl-4 border-l-2 border-border">
                {comment.replies.map((reply) => (
                  <div key={reply.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-muted-foreground">
                        {reply.author.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-foreground">
                          {reply.author}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(reply.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            }
                          )}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90">
                        {reply.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

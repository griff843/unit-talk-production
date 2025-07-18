"use client";

import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import dayjs from "dayjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LegCard } from "./LegCard";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  CAPPER_OPTIONS,
  SPORTS,
  TICKET_TYPES,
  TicketFormData,
  TicketLeg,
  ticketFormSchema,
  Sport,
  SearchResults,
  Player,
  Game,
  CapperName,
  BetType
} from "../types";
import { Card } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";

export function SubmitTicketForm() {
  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      capper: CAPPER_OPTIONS[0],
      ticket_type: "Single",
      unit_size: 1,
      auto_parlay: true,
      sport: "NBA",
      game_date: dayjs().format("YYYY-MM-DD"),
      legs: [createLeg(true)],
      confidence_level: 7,
      user_tier: "member"
    }
  });

  const [searchResults, setSearchResults] = useState<SearchResults>({ props: [], games: [] });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  function createLeg(isPrimary = false): TicketLeg {
    return {
      id: uuidv4(),
      bet_type: "Player Prop",
      stat_type: "",
      player_name: "",
      team: "",
      line: "",
      odds: "",
      outcome: "",
      matchup: "",
      is_primary: isPrimary,
      created_at: new Date().toISOString()
    };
  }

  const onSubmit = async (data: TicketFormData) => {
    try {
      setIsSubmitting(true);
      // Validate unit size
      if (data.unit_size < 0.5 || data.unit_size > 5) {
        toast({
          title: "Invalid Unit Size",
          description: "Unit size must be between 0.5 and 5",
          variant: "destructive"
        });
        return;
      }

      // Check if Supabase is configured
      if (!isSupabaseConfigured()) {
        toast({
          title: "Configuration Error",
          description: "Database connection is not properly configured",
          variant: "destructive"
        });
        return;
      }

      // Submit the form data to Supabase
      const { data: submittedData, error } = await supabase
        .from('tickets')
        .insert([
          {
            capper: data.capper,
            ticket_type: data.ticket_type,
            unit_size: data.unit_size,
            auto_parlay: data.auto_parlay,
            sport: data.sport,
            game_date: data.game_date,
            legs: data.legs,
            confidence_level: data.confidence_level,
            user_tier: data.user_tier,
            created_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "Ticket Submitted",
        description: "Your ticket has been successfully submitted.",
        variant: "default"
      });

      // Reset form
      form.reset({
        capper: CAPPER_OPTIONS[0],
        ticket_type: "Single",
        unit_size: 1,
        auto_parlay: true,
        sport: "NBA",
        game_date: dayjs().format("YYYY-MM-DD"),
        legs: [createLeg(true)],
        confidence_level: 7,
        user_tier: "member"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add a new leg to the ticket
  const addLeg = () => {
    const currentLegs = form.getValues("legs") || [];
    form.setValue("legs", [...currentLegs, createLeg(false)]);
  };

  // Remove a leg from the ticket
  const removeLeg = (index: number) => {
    const currentLegs = form.getValues("legs") || [];
    if (currentLegs[index]?.is_primary) {
      toast({
        title: "Cannot Remove Primary Leg",
        description: "The primary leg cannot be removed from the ticket.",
        variant: "destructive"
      });
      return;
    }
    form.setValue("legs", currentLegs.filter((_, i) => i !== index));
  };

  // Update a leg's properties
  const updateLeg = (index: number, updates: Partial<TicketLeg>) => {
    const currentLegs = form.getValues("legs") || [];
    const updatedLegs = currentLegs.map((leg, i) => {
      if (i === index) {
        return { ...leg, ...updates };
      }
      return leg;
    });
    form.setValue("legs", updatedLegs);
  };

  // Handle leg type change
  const handleLegTypeChange = (index: number, value: BetType) => {
    updateLeg(index, { bet_type: value });
  };

  // Search for players or games
  const handleSearch = async (index: number, query: string) => {
    if (!query || query.length < 2) {
      setSearchResults({ props: [], games: [] });
      return;
    }

    try {
      const sport = form.getValues("sport");
      const legType = form.getValues(`legs.${index}.bet_type`);

      // Mock search results for demonstration
      if (legType === "Player Prop") {
        // In a real app, this would be a database query
        const mockPlayers: Player[] = [
          {
            id: uuidv4(),
            player_name: `${query} Smith`,
            team: "Lakers",
            photo_url: "https://example.com/player.jpg"
          },
          {
            id: uuidv4(),
            player_name: `${query} Johnson`,
            team: "Celtics",
            photo_url: "https://example.com/player2.jpg"
          }
        ];
        setSearchResults({ props: mockPlayers, games: [] });
      } else {
        // Search for games/teams
        const mockGames: Game[] = [
          {
            id: uuidv4(),
            matchup: "Lakers vs Celtics",
            home_team: "Lakers",
            away_team: "Celtics",
            game_date: dayjs().format("YYYY-MM-DD"),
            sport: sport
          },
          {
            id: uuidv4(),
            matchup: "Warriors vs Nets",
            home_team: "Warriors",
            away_team: "Nets",
            game_date: dayjs().format("YYYY-MM-DD"),
            sport: sport
          }
        ];
        setSearchResults({ props: [], games: mockGames });
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults({ props: [], games: [] });
    }
  };

  // Handle player selection
  const handleSelectPlayer = (index: number, player: Player) => {
    updateLeg(index, {
      player_name: player.player_name,
      team: player.team
    });
  };

  // Handle game selection
  const handleSelectGame = (index: number, game: Game) => {
    updateLeg(index, {
      matchup: game.matchup
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl mx-auto space-y-6 p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Submit Ticket</h1>
          <ThemeToggle />
        </div>
        
        <Card className="p-6 space-y-6 dark:bg-gray-800 dark:border-gray-700">
          {/* Header Section */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Capper Name</label>
              <Select
                value={form.watch("capper")}
                onValueChange={(value: CapperName) => form.setValue("capper", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Capper" />
                </SelectTrigger>
                <SelectContent>
                  {CAPPER_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Game Date</label>
              <Input
                type="date"
                value={form.watch("game_date")}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValue("game_date", e.target.value)}
              />
            </div>
          </div>

          {/* Ticket Info Section */}
          <div className="grid md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ticket Type</label>
              <Select
                value={form.watch("ticket_type")}
                onValueChange={(value: typeof TICKET_TYPES[number]) => form.setValue("ticket_type", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Sport</label>
              <Select
                value={form.watch("sport")}
                onValueChange={(value: Sport) => form.setValue("sport", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Sport" />
                </SelectTrigger>
                <SelectContent>
                  {SPORTS.map((sp) => (
                    <SelectItem key={sp} value={sp}>{sp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Unit Amount</label>
              <Input
                type="number"
                min={0.5}
                max={5}
                step={0.5}
                value={form.watch("unit_size")}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const value = parseFloat(e.target.value);
                  if (value >= 0.5 && value <= 5) {
                    form.setValue("unit_size", value);
                  }
                }}
                className="w-full"
              />
            </div>

            <div className="space-y-2 flex items-end">
              <label className="flex items-center gap-2 h-10">
                <input
                  type="checkbox"
                  checked={form.watch("auto_parlay")}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValue("auto_parlay", e.target.checked)}
                  className="w-4 h-4 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="dark:text-gray-200">Auto Parlay</span>
              </label>
            </div>
          </div>
        </Card>

        {/* Legs Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold dark:text-white text-gray-900">Ticket Legs</h2>
            <Button
              type="button"
              onClick={addLeg}
              variant="outline"
              className="text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
            >
              + Add Leg
            </Button>
          </div>

          {form.watch("legs")?.map((leg, index) => (
            <LegCard
              key={leg.id}
              leg={leg}
              index={index}
              sport={form.watch("sport")}
              onUpdate={updateLeg}
              onRemove={removeLeg}
              onSearch={handleSearch}
              searchResults={searchResults}
              onSelectPlayer={handleSelectPlayer}
              onSelectGame={handleSelectGame}
              isPrimary={leg.is_primary}
              onLegTypeChange={handleLegTypeChange}
            />
          ))}
        </div>

        <Button
          type="submit"
          className="w-full py-6 text-lg font-semibold bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "✓ Submit Ticket"}
        </Button>
      </form>
    </Form>
  );
}
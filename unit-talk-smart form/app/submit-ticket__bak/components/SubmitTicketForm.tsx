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
      legs: [createLeg(true)]
    }
  });

  const [searchResults, setSearchResults] = useState<SearchResults>({});
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

  const updateLeg = (index: number, updates: Partial<TicketLeg>) => {
    const newLegs = [...form.getValues("legs")];
    newLegs[index] = { ...newLegs[index], ...updates };
    form.setValue("legs", newLegs, { shouldValidate: true });
  };

  const handleSearch = async (index: number, query: string) => {
    if (!query) return;
    const leg = form.getValues("legs")[index];
    if (leg.bet_type === "Player Prop") {
      const { data } = await supabase
        .from("raw_props")
        .select("*")
        .ilike("player_name", `%${query}%`)
        .limit(10);
      setSearchResults((prev) => ({
        ...prev,
        [index]: { props: data || [], games: [] }
      }));
    } else {
      const { data } = await supabase
        .from("games")
        .select("*")
        .or(`home_team.ilike.%${query}%,away_team.ilike.%${query}%,matchup.ilike.%${query}%`)
        .limit(10);
      setSearchResults((prev) => ({
        ...prev,
        [index]: { games: data || [], props: [] }
      }));
    }
  };

  const handleSelectPlayer = (index: number, player: Player) => {
    updateLeg(index, {
      player_name: player.player_name,
      team: player.team,
      odds: player.odds || "",
      stat_type: player.stat_type || "",
      line: player.line || ""
    });
    clearSearch(index);
  };

  const handleSelectGame = (index: number, game: Game) => {
    updateLeg(index, {
      matchup: game.matchup || `${game.home_team} vs ${game.away_team}`,
      team: "",
      odds: game.odds || ""
    });
    clearSearch(index);
  };

  const clearSearch = (index: number) => {
    setSearchResults((prev) => ({
      ...prev,
      [index]: { props: [], games: [] }
    }));
  };

  const handleRemoveLeg = (index: number) => {
    const newLegs = form.getValues("legs").filter((_, i) => i !== index);
    form.setValue("legs", newLegs, { shouldValidate: true });
  };

  const addLeg = () => {
    const currentLegs = form.getValues("legs");
    const currentType = form.getValues("ticket_type");
    
    if (currentType === 'Single' && currentLegs.length >= 1) {
      toast({
        title: "Invalid Action",
        description: "Single tickets can only have one leg",
        variant: "destructive"
      });
      return;
    }
    
    const newLegs = [...currentLegs, createLeg(false)];
    form.setValue("legs", newLegs, { shouldValidate: true });
    validateTicketType(currentType, newLegs);
  };

  const onSubmit = async (data: TicketFormData) => {
    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase is not properly configured. Please check your environment variables.');
      }

      setIsSubmitting(true);
      const ticketId = uuidv4();
      const timestamp = new Date().toISOString();

      // Validate ticket type specific requirements
      if (data.ticket_type === 'Parlay' && data.legs.length < 2) {
        throw new Error('Parlay tickets require at least 2 legs');
      }
      if (data.ticket_type === 'Round Robin' && data.legs.length < 3) {
        throw new Error('Round Robin tickets require at least 3 legs');
      }
      if (data.ticket_type === 'Teaser' && !data.legs.every(leg => 
        leg.bet_type === 'Spread' || leg.bet_type === 'Total'
      )) {
        throw new Error('Teaser tickets can only contain Spread or Total bets');
      }

      const cleanedLegs = data.legs.map((leg, index) => ({
        ...leg,
        ticket_id: ticketId,
        game_date: data.game_date,
        sport: data.sport,
        is_primary: index === 0,
        created_at: timestamp
      }));

      // Insert ticket
      const { error: ticketError } = await supabase.from("tickets").insert([{
        id: ticketId,
        capper: data.capper,
        ticket_type: data.ticket_type,
        unit_size: data.unit_size,
        auto_parlay: data.auto_parlay,
        sport: data.sport,
        game_date: data.game_date,
        created_at: timestamp
      }]);

      if (ticketError) {
        throw new Error(ticketError.message);
      }

      // Insert legs
      const { error: legsError } = await supabase.from("ticket_legs").insert(cleanedLegs);
      if (legsError) {
        // If legs insertion fails, try to clean up the ticket
        await supabase.from("tickets").delete().match({ id: ticketId });
        throw new Error(legsError.message);
      }

      toast({
        title: "Success!",
        description: "Your ticket has been submitted.",
        variant: "success"
      });

      // Reset form
      form.reset({
        capper: CAPPER_OPTIONS[0],
        ticket_type: "Single",
        unit_size: 1,
        auto_parlay: true,
        sport: "NBA",
        game_date: dayjs().format("YYYY-MM-DD"),
        legs: [createLeg(true)]
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit ticket",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add validation for ticket type requirements
  const validateTicketType = (type: typeof TICKET_TYPES[number], legs: TicketLeg[]) => {
    const newErrors: string[] = [];
    
    switch (type) {
      case 'Parlay':
        if (legs.length < 2) {
          newErrors.push('Parlay tickets require at least 2 legs');
        }
        break;
      case 'Round Robin':
        if (legs.length < 3) {
          newErrors.push('Round Robin tickets require at least 3 legs');
        }
        break;
      case 'Teaser':
        if (!legs.every(leg => leg.bet_type === 'Spread' || leg.bet_type === 'Total')) {
          newErrors.push('Teaser tickets can only contain Spread or Total bets');
        }
        break;
    }
    
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  // Update the ticket type change handler
  const handleTicketTypeChange = (value: typeof TICKET_TYPES[number]) => {
    form.setValue("ticket_type", value);
    validateTicketType(value, form.getValues("legs"));
  };

  // Update the leg type change handler
  const handleLegTypeChange = (index: number, value: BetType) => {
    const currentTicketType = form.getValues("ticket_type");
    if (currentTicketType === 'Teaser' && value !== 'Spread' && value !== 'Total') {
      toast({
        title: "Invalid Selection",
        description: "Teaser tickets can only contain Spread or Total bets",
        variant: "destructive"
      });
      return;
    }
    
    updateLeg(index, { bet_type: value });
    validateTicketType(currentTicketType, form.getValues("legs"));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl mx-auto space-y-6 p-6">
        <Card className="p-6 space-y-6 bg-gray-900 border-gray-700">
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
              {form.formState.errors.capper && (
                <p className="text-sm text-red-500">{form.formState.errors.capper.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Game Date</label>
              <Input
                type="date"
                value={form.watch("game_date")}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValue("game_date", e.target.value)}
              />
              {form.formState.errors.game_date && (
                <p className="text-sm text-red-500">{form.formState.errors.game_date.message}</p>
              )}
            </div>
          </div>

          {/* Ticket Info Section */}
          <div className="grid md:grid-cols-4 gap-4">
            <Select
              value={form.watch("ticket_type")}
              onValueChange={handleTicketTypeChange}
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

            <Input
              type="number"
              min={0.5}
              max={5}
              step={0.5}
              value={form.watch("unit_size")}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValue("unit_size", parseFloat(e.target.value))}
              className="w-24"
            />

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.watch("auto_parlay")}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValue("auto_parlay", e.target.checked)}
              />
              Auto Parlay
            </label>
          </div>
        </Card>

        {/* Legs Section */}
        <div className="space-y-4">
          {form.watch("legs").map((leg, index) => (
            <LegCard
              key={leg.id}
              leg={leg}
              index={index}
              sport={form.watch("sport")}
              onUpdate={updateLeg}
              onRemove={handleRemoveLeg}
              onSearch={handleSearch}
              searchResults={searchResults[index] || { props: [], games: [] }}
              onSelectPlayer={handleSelectPlayer}
              onSelectGame={handleSelectGame}
              isPrimary={index === 0}
              onLegTypeChange={handleLegTypeChange}
            />
          ))}

          <Button
            type="button"
            onClick={addLeg}
            variant="outline"
            className="w-full"
          >
            ➕ Add Leg
          </Button>
        </div>

        {errors.length > 0 && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 rounded">
            {errors.map((error, index) => (
              <p key={index} className="text-red-700">{error}</p>
            ))}
          </div>
        )}

        <Button
          type="submit"
          className="w-full py-6 text-lg font-semibold"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "✅ Submit Ticket"}
        </Button>
      </form>
    </Form>
  );
} 
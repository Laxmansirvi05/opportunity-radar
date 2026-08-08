#!/bin/bash
# AI Assistant Migration Script
# This will push the missing tables to your Supabase database.
echo "Applying AI Assistant migration to Supabase..."
npx supabase migration up

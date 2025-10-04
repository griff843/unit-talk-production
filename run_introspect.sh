#!/bin/bash
cd "C:\Users\griff\OneDrive\Desktop\unit-talk-production-main"
supabase db push --password Adalise843! --dry-run &> /dev/null
psql "postgresql://postgres.lxqmuzmqtnnlpfapvief:Adalise843!@aws-0-us-east-1.pooler.supabase.com:6543/postgres" -f check_columns.sql

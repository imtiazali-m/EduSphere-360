import { useEffect, useState, type FormEvent } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/data-management.css'
type Row=Record<string,any>&{id:string}
const titles:Record<string,string>={'asset-assignment':'Asset Assignment','asset-transfers':'Asset Transfers','asset-warranty':'Asset Warranty','asset-disposal':'Asset Disposal','asset-reports':'Asset Lifecycle Reports'}

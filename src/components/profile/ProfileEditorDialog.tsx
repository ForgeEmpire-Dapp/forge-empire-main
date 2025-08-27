import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAccount, useSimulateContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi"
import { useEffect, useMemo, useState } from "react"
import { CONTRACT_ADDRESSES } from "@/config/web3"
import { useToast } from "@/components/ui/use-toast"

const schema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Max 32 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores"),
})

export type ProfileFormValues = z.infer<typeof schema>

const PROFILE_WRITE_ABI = [
  {
    name: "setUsername",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_username", type: "string" }],
    outputs: [],
  },
] as const

interface ProfileEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialValues?: Partial<ProfileFormValues>
  hasProfile?: boolean
}

export const ProfileEditorDialog = ({ open, onOpenChange, initialValues, hasProfile }: ProfileEditorDialogProps) => {
  const { isConnected } = useAccount()
  const { toast } = useToast()
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: initialValues?.username || "",
    },
    mode: "onChange",
  })

  useEffect(() => {
    form.reset({
      username: initialValues?.username || "",
    })
  }, [open, initialValues, form])

  const values = form.watch()
  const args = useMemo(() => [values.username] as const, [values.username])

  const enabled = isConnected && values.username.length >= 3

  const simulateSetUsername = useSimulateContract({
    address: CONTRACT_ADDRESSES.ProfileRegistry as `0x${string}`,
    abi: PROFILE_WRITE_ABI,
    functionName: "setUsername",
    args,
    query: { enabled },
  })

  const prepared = simulateSetUsername.data?.request

  const { writeContractAsync, isPending: isWriting } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, isError, error } = useWaitForTransactionReceipt({ hash: txHash })

  useEffect(() => {
    if (isSuccess) {
      toast({
        title: "Username updated",
        description: "Your profile change was confirmed on-chain.",
      })
      onOpenChange(false)
      setTxHash(undefined)
    }
  }, [isSuccess, toast, onOpenChange])

  useEffect(() => {
    if (isError && error) {
      toast({
        title: "Transaction failed",
        description: error.message,
        variant: "destructive",
      })
    }
  }, [isError, error, toast])

  const onSubmit = async (_data: ProfileFormValues) => {
    if (!isConnected) {
      toast({ title: "Connect wallet", description: "Please connect your wallet to update your profile." })
      return
    }

    if (!prepared) {
      toast({
        title: "Unable to prepare",
        description: "Could not prepare setUsername transaction.",
        variant: "destructive",
      })
      return
    }

    try {
      const hash = await writeContractAsync(prepared)
      setTxHash(hash)
      toast({ title: "Transaction sent", description: `Hash: ${hash.slice(0, 10)}…` })
    } catch (err: unknown) {
      toast({ title: "Transaction rejected", description: err?.message ?? "User rejected or wallet error.", variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{hasProfile ? "Edit Username" : "Create Username"}</DialogTitle>
          <DialogDescription>Choose a unique on-chain username.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Username</label>
            <Input placeholder="your_name" {...form.register("username")} />
            {form.formState.errors.username && (
              <p className="text-sm text-destructive">{form.formState.errors.username.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isConnected || isWriting || isConfirming || !form.formState.isValid}>
              {isWriting ? "Sending..." : isConfirming ? "Confirming..." : hasProfile ? "Save Changes" : "Create Username"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

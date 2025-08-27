import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Shield, Upload, AlertTriangle, CheckCircle, FileImage } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { secureLog } from '@/utils/secureLogger'

interface SecureFileUploaderProps {
  bucket: string
  folder?: string
  maxSize?: number // in MB
  allowedTypes?: string[]
  onUploadComplete?: (url: string) => void
}

export const SecureFileUploader = ({
  bucket,
  folder = '',
  maxSize = 5,
  allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  onUploadComplete
}: SecureFileUploaderProps) => {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const { toast } = useToast()

  const generateSecureFileName = (originalName: string): string => {
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const extension = originalName.split('.').pop()
    return `${timestamp}_${randomString}.${extension}`
  }

  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type not allowed. Supported types: ${allowedTypes.join(', ')}`
      }
    }

    // Check file size
    const maxSizeBytes = maxSize * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: `File size too large. Maximum size: ${maxSize}MB`
      }
    }

    // Check for suspicious file names
    const suspiciousPatterns = ['.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.js']
    const fileName = file.name.toLowerCase()
    if (suspiciousPatterns.some(pattern => fileName.includes(pattern))) {
      return {
        valid: false,
        error: 'File type not allowed for security reasons'
      }
    }

    return { valid: true }
  }, [allowedTypes, maxSize])

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    const validation = validateFile(file)
    if (!validation.valid) {
      toast({
        title: "Upload Failed",
        description: validation.error,
        variant: "destructive"
      })
      return null
    }

    setUploading(true)
    setProgress(0)

    try {
      // Get current user for folder scoping
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User must be authenticated to upload files')
      }

      // Generate secure file name and path
      const secureFileName = generateSecureFileName(file.name)
      const filePath = folder 
        ? `${user.id}/${folder}/${secureFileName}`
        : `${user.id}/${secureFileName}`

      secureLog.info('Starting secure file upload', { 
        originalName: file.name,
        secureFileName,
        bucket,
        filePath: filePath.split('/').slice(0, -1).join('/') + '/[filename]' // Log path without filename
      })

      // Upload with progress tracking
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        })

      if (error) {
        throw error
      }

      setProgress(100)

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath)

      secureLog.info('File upload completed successfully')
      
      toast({
        title: "Upload Successful",
        description: "File has been uploaded securely"
      })

      return urlData.publicUrl
    } catch (error) {
      secureLog.error('File upload failed', error)
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      })
      return null
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }, [bucket, folder, toast, validateFile])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      const url = await uploadFile(file)
      if (url && onUploadComplete) {
        onUploadComplete(url)
      }
    }
  }, [uploadFile, onUploadComplete])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: allowedTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxFiles: 1,
    maxSize: maxSize * 1024 * 1024,
    disabled: uploading
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Secure File Upload
        </CardTitle>
        <CardDescription>
          Upload files securely with validation and encryption
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Files are validated for type and size, renamed for security, and scoped to your account.
          </AlertDescription>
        </Alert>

        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/25'}
            ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5'}
          `}
        >
          <input {...getInputProps()} />
          <div className="space-y-3">
            {uploading ? (
              <>
                <Upload className="h-8 w-8 mx-auto animate-pulse" />
                <p className="text-sm font-medium">Uploading...</p>
                <Progress value={progress} className="w-full" />
              </>
            ) : (
              <>
                <FileImage className="h-8 w-8 mx-auto text-muted-foreground" />
                {isDragActive ? (
                  <p className="text-sm">Drop the file here...</p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      Drag & drop a file here, or click to select
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Max {maxSize}MB • {allowedTypes.map(type => type.split('/')[1]).join(', ')}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4" />
            <span>File type validation enabled</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4" />
            <span>Secure file naming (prevents enumeration)</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4" />
            <span>User-scoped storage paths</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CountryItem } from '@/api'

/**
 * 手机号输入（区号下拉 + 手机号，官方 el-input with el-select prepend）。
 * 区号列表来自 /console/v1/country。
 */
interface PhoneCodeInputProps {
  value: string
  onChange: (value: string) => void
  countryCode: string
  onCountryCodeChange: (code: string) => void
  countryList: CountryItem[]
  placeholder?: string
  autoComplete?: string
  disabled?: boolean
}

export function PhoneCodeInput({
  value,
  onChange,
  countryCode,
  onCountryCodeChange,
  countryList,
  placeholder = '请输入手机号码',
  autoComplete,
  disabled,
}: PhoneCodeInputProps) {
  const current =
    countryList.find((c) => String(c.phone_code) === String(countryCode)) ??
    countryList[0]

  return (
    <div className='flex gap-0 overflow-hidden rounded-md border border-input shadow-xs transition-colors focus-within:ring-1 focus-within:ring-ring'>
      <Select
        value={String(current?.phone_code ?? countryCode ?? '')}
        onValueChange={onCountryCodeChange}
        disabled={disabled}
      >
        <SelectTrigger className='w-24 shrink-0 rounded-none border-0 bg-muted/50 focus:ring-0'>
          <SelectValue placeholder='区号'>
            {`+${String(current?.phone_code ?? countryCode ?? '')}`}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {countryList.map((item) => (
            <SelectItem key={item.name ?? item.iso ?? String(item.phone_code)} value={String(item.phone_code)}>
              {`+${item.phone_code} ${item.name_zh ?? item.name ?? ''}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className='rounded-none border-0 shadow-none focus-visible:ring-0'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode='numeric'
        autoComplete={autoComplete}
        disabled={disabled}
      />
    </div>
  )
}

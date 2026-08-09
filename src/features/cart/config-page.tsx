import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  addCartItem,
  fetchProductDetail,
  fetchProductGroupSecond,
  fetchProductList,
  fetchProductPrice,
  fetchRemfCascader,
  fetchRemfCustomFields,
  fetchRemfFinanceOrderPage,
  updateCartItem,
  type CommonConfig,
  type ProductPriceData,
  type ProductListItem,
  type RemfConfigCycle,
  type RemfConfigOptionItem,
  type RemfConfigSonItem,
  type RemfCustomFieldItem,
} from '@/api'
import {
  Check,
  Eye,
  EyeOff,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/api'
import { stripPreviewPrefix } from '@/lib/preview'
import { PreviewIcon } from '@/lib/preview-icon'
import { remfHasLinkRoute, type RemfModule } from '@/lib/remf-module'
import { cn } from '@/lib/utils'
import { useModuleLang, type ModuleTranslator } from '@/hooks/use-module-lang'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { FadeText } from '@/components/fade-text'
import {
  AREA_TYPE,
  CASCADER_TYPE,
  CLICK_TYPES,
  RANGE_TYPES,
  SELECT_TYPE,
  SWITCH_TYPE,
  SYSTEM_TYPE,
  applyInitLimits,
  collectConfigForm,
  formatCartParams,
  genPassword,
  handleOptionChange,
  prepareOptions,
  verifyCustomFields,
  type ConfigForm,
} from '@/features/cart/config-engine'
import { SystemIcon, SystemSelector } from '@/features/cart/system-selector'

interface StoredProductInformation {
  config_options?: {
    configoption: Record<string, string | number>
    cycle?: string
    host?: string
    password?: string
  }
  position?: number
  qty?: number
  customfield?: Record<string, unknown>
  self_defined_field?: Record<string, string>
}

function formatMoney(value: number | string | undefined): string {
  const num = Number(value)
  if (Number.isNaN(num) || num < 0) return '0.00'
  return num.toFixed(2)
}

function isRangeType(type: number): boolean {
  return RANGE_TYPES.includes(type)
}

function isClickType(type: number): boolean {
  return CLICK_TYPES.includes(type)
}

function isBandwidthOption(item: RemfConfigOptionItem): boolean {
  return isRangeType(item.option_type) && item.unit === 'Mbps'
}

// ---------- 布局单元 ----------

/** 配置区块：桌面端左侧固定宽度标签 + 右侧内容，移动端标签置顶 */
function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className='grid items-start gap-2.5 px-5 py-5 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4 sm:px-6'>
      <div className='pt-2 text-sm font-semibold text-foreground'>{label}</div>
      <div className='min-w-0'>{children}</div>
    </div>
  )
}

/** 更多配置/自定义字段行：左侧标签 + 右侧控件（与 Section 标签列同宽对齐） */
function ConfigRow({
  label,
  children,
}: {
  label: ReactNode
  children: ReactNode
}) {
  return (
    <div className='grid items-start gap-2.5 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4'>
      <div className='pt-2 text-sm font-medium text-foreground'>{label}</div>
      <div className='min-w-0'>{children}</div>
    </div>
  )
}

interface ConfigItemControlProps {
  item: RemfConfigOptionItem
  value: string | number
  systemValue: string
  onSystemChange: (system: string) => void
  onValueChange: (value: number | string) => void
  t: ModuleTranslator
}

/** 通用配置项控件（按 option_type 分派，用于「更多配置」行） */
function ConfigItemControl({
  item,
  value,
  systemValue,
  onSystemChange,
  onValueChange,
  t,
}: ConfigItemControlProps) {
  const type = item.option_type
  const placeholder = t('com_config.please_select', '请选择')
  if (type === SELECT_TYPE) {
    const subs = item.sub as Array<{ id: number; option_name: string }>
    return (
      <Select
        value={String(value)}
        onValueChange={(v) => onValueChange(Number(v))}
      >
        <SelectTrigger className='w-full sm:w-56'>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {subs.map((sub) => (
            <SelectItem key={sub.id} value={String(sub.id)}>
              {sub.option_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (type === SWITCH_TYPE) {
    const subs = item.sub as Array<{ id: number }>
    const activeValue = subs[0]?.id ?? 0
    return (
      <Switch
        checked={value === activeValue}
        disabled={item.disabled}
        onCheckedChange={(checked) => onValueChange(checked ? activeValue : 0)}
      />
    )
  }

  if (isRangeType(type)) {
    const min = item.qty_minimum
    const max = item.qty_maximum
    return (
      <div className='flex flex-wrap items-center gap-2'>
        <span className='text-xs text-muted-foreground'>{min}</span>
        <input
          type='range'
          className='h-2 w-36 cursor-pointer appearance-none rounded-full bg-muted accent-primary'
          min={min}
          max={max}
          step={1}
          value={Number(value)}
          onChange={(e) => onValueChange(Number(e.target.value))}
        />
        <span className='text-xs text-muted-foreground'>{max}</span>
        <Input
          type='number'
          // field-sizing: content 让输入框宽度随内容自适应，长数值不再截断
          className='[field-sizing:content] h-8 w-16 min-w-10'
          min={min}
          max={max}
          value={Number(value)}
          onChange={(e) => {
            const num = Number(e.target.value)
            const clamped = Math.min(max, Math.max(min, num))
            onValueChange(Number.isNaN(num) ? min : clamped)
          }}
        />
        {item.unit && (
          <span className='text-xs text-muted-foreground'>{item.unit}</span>
        )}
      </div>
    )
  }

  if (isClickType(type)) {
    const subs = item.sub as Array<{ id: number; option_name: string }>
    return (
      <div className='flex flex-wrap gap-2'>
        {subs.map((sub) => {
          const active = sub.id === value
          return (
            <button
              key={sub.id}
              type='button'
              onClick={() => onValueChange(sub.id)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm transition-colors',
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-foreground hover:border-primary/50'
              )}
            >
              {sub.option_name}
            </button>
          )
        })}
        {item.unit && (
          <span className='self-center text-xs text-muted-foreground'>
            {item.unit}
          </span>
        )}
      </div>
    )
  }

  if (type === SYSTEM_TYPE) {
    const group = item.sub as Record<
      string,
      { child: Array<{ id: number; version: string }> }
    >
    const systemArr =
      item.systemArr ?? Object.keys(group).map((v) => ({ value: v, label: v }))
    const child = group[systemValue]?.child ?? []
    return (
      <div className='flex flex-wrap items-center gap-2'>
        <Select value={systemValue} onValueChange={onSystemChange}>
          <SelectTrigger className='w-36'>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {systemArr.map((sys) => (
              <SelectItem key={sys.value} value={sys.value}>
                <span className='flex items-center gap-2'>
                  <SystemIcon
                    value={sys.value}
                    icoUrl={
                      (group[sys.value] as { ico_url?: string } | undefined)
                        ?.ico_url
                    }
                    className='h-4 w-4'
                  />
                  {sys.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={String(value)}
          onValueChange={(v) => onValueChange(Number(v))}
        >
          <SelectTrigger className='w-52'>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {child.map((ver) => (
              <SelectItem key={ver.id} value={String(ver.id)}>
                {ver.version}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (type === AREA_TYPE) {
    const subs = item.sub as Array<{
      id: number
      option_name: string
      country_code?: string
      area: Array<{ id: number }>
    }>
    return (
      <div className='flex flex-wrap gap-2'>
        {subs.map((sub) => {
          const areaId = sub.area[0]?.id
          const active = areaId === value
          return (
            <button
              key={sub.id}
              type='button'
              onClick={() => onValueChange(areaId)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors',
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-foreground hover:border-primary/50'
              )}
            >
              {sub.country_code && (
                <img
                  src={`/upload/common/country/${sub.country_code}.png`}
                  alt=''
                  className='h-3.5 w-5 object-cover'
                />
              )}
              {sub.option_name}
              {active && <Check className='h-3.5 w-3.5 shrink-0' />}
            </button>
          )
        })}
      </div>
    )
  }

  return null
}

interface CascaderConfigProps {
  item: RemfConfigOptionItem
  activeId: number | string | undefined
  sonList: RemfConfigSonItem[] | undefined
  onParentClick: (subId: number | string) => void
  onSonClick: (sonId: number, subId: number) => void
}

/** 级联配置项（option_type 20） */
function CascaderConfigItem({
  item,
  activeId,
  sonList,
  onParentClick,
  onSonClick,
}: CascaderConfigProps) {
  const subs = item.sub as Array<{ id: number; option_name: string }>
  return (
    <div>
      <div className='flex flex-wrap gap-2'>
        {subs.map((sub) => {
          const active = sub.id === activeId
          return (
            <button
              key={sub.id}
              type='button'
              onClick={() => onParentClick(sub.id)}
              className={cn(
                'relative rounded-md border px-4 py-2 text-sm transition-colors',
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-foreground hover:border-primary/50'
              )}
            >
              {sub.option_name}
            </button>
          )
        })}
      </div>
      {(sonList ?? []).map((son) => (
        <div key={son.id} className='mt-3 pl-4'>
          <p className='mb-2 text-sm font-medium'>{son.option_name}</p>
          <div className='flex flex-wrap gap-2'>
            {(son.sub ?? []).map((el) => {
              const active = el.id === Number(son.checkSubId)
              return (
                <button
                  key={el.id}
                  type='button'
                  onClick={() => onSonClick(son.id, el.id)}
                  className={cn(
                    'relative rounded-md border px-4 py-2 text-sm transition-colors',
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-foreground hover:border-primary/50'
                  )}
                >
                  {el.option_name}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

interface CustomFieldProps {
  field: RemfCustomFieldItem
  value: string
  onChange: (value: string) => void
}

/** 自定义字段控件 */
function CustomFieldControl({ field, value, onChange }: CustomFieldProps) {
  const [showPassword, setShowPassword] = useState(false)
  if (field.field_type === 'textarea') {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.description}
      />
    )
  }
  if (field.field_type === 'tickbox') {
    return (
      <div className='flex items-center gap-2'>
        <Checkbox
          checked={value === '1'}
          disabled={field.is_required === 1}
          onCheckedChange={(checked) => onChange(checked ? '1' : '0')}
        />
        {field.description && (
          <span className='text-sm text-muted-foreground'>
            {field.description}
          </span>
        )}
      </div>
    )
  }
  if (field.field_type === 'dropdown') {
    const options = (field.field_option ?? '').split(',').filter(Boolean)
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className='w-full sm:w-56'>
          <SelectValue placeholder={field.description} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  const isPassword = field.field_type === 'password'
  if (isPassword) {
    return (
      <div className='relative w-full sm:w-56'>
        <Input
          type={showPassword ? 'text' : 'password'}
          className='pr-9'
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.description}
        />
        <button
          type='button'
          aria-label={showPassword ? '隐藏密码' : '查看密码'}
          className='absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground'
          onClick={() => setShowPassword((prev) => !prev)}
        >
          {showPassword ? (
            <EyeOff className='h-3.5 w-3.5' />
          ) : (
            <Eye className='h-3.5 w-3.5' />
          )}
        </button>
      </div>
    )
  }
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.description}
    />
  )
}

interface MfFinanceConfigPageProps {
  id: number
  commonData?: CommonConfig
  change?: boolean
  /** remf 通用商品模块（goods 页从内容 HTML 探测；决定 order_page/link 接口与语言文件） */
  module?: RemfModule
}

/**
 * mf_finance 系列（通用商品）配置页原生实现（阿里云 ECS 购买页排版）：
 * 左侧分节配置（同分组产品/镜像/地域/带宽值/更多配置），
 * 右侧 sticky 配置概要（明细 + 时长/数量 + 价格 + 下单）。
 * 文案走官方插件 lang/index.js（useModuleLang），不写死中文。
 */
export function MfFinanceConfigPage({
  id,
  commonData,
  change,
  module = 'mf_finance',
}: MfFinanceConfigPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useModuleLang(module)
  const [options, setOptions] = useState<RemfConfigOptionItem[]>([])
  const [form, setForm] = useState<ConfigForm>({})
  const [curSystem, setCurSystem] = useState('')
  const [cycle, setCycle] = useState('')
  const [qty, setQty] = useState(1)
  const [position, setPosition] = useState<number | undefined>()
  const [customFields, setCustomFields] = useState<RemfCustomFieldItem[]>([])
  const [customObj, setCustomObj] = useState<Record<string, string>>({})
  const [cascaderActive, setCascaderActive] = useState<
    Record<number, number | string>
  >({})
  const [cascaderSon, setCascaderSon] = useState<
    Record<number, RemfConfigSonItem[]>
  >({})
  const cascaderParamsRef = useRef<Record<number, number | string>>({})
  const [priceData, setPriceData] = useState<ProductPriceData | undefined>()
  const [priceLoading, setPriceLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [cartDialog, setCartDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const initRef = useRef(false)
  const priceSeqRef = useRef(0)
  const currencyPrefix =
    (commonData?.currency_prefix as string | undefined) ?? '¥'

  const orderQuery = useQuery({
    queryKey: ['remf-order-page', module, id],
    queryFn: () => fetchRemfFinanceOrderPage(id, module),
    enabled: id > 0,
    retry: false,
  })
  const fieldsQuery = useQuery({
    queryKey: ['remf-custom-fields', id],
    queryFn: () => fetchRemfCustomFields(id),
    enabled: id > 0,
    retry: false,
  })

  // 同分组产品（官方 goods 切换弹层同款查询，queryKey 与 goods.tsx 共享缓存）
  const detailQuery = useQuery({
    queryKey: ['cart-goods-detail', id],
    queryFn: () => fetchProductDetail(id),
    enabled: id > 0,
    retry: false,
  })
  const firstGroupId =
    detailQuery.data?.data.product.product_group_id_first ?? null
  const groupsQuery = useQuery({
    queryKey: ['cart-goods-change-groups', firstGroupId],
    queryFn: () => fetchProductGroupSecond(firstGroupId!),
    enabled: firstGroupId != null,
    retry: false,
  })
  const secondGroups = groupsQuery.data?.data.list ?? []
  const groupGoodsQueries = useQueries({
    queries: secondGroups.map((group) => ({
      queryKey: ['cart-goods-change-products', group.id],
      queryFn: () => fetchProductList({ id: group.id, page: 1, limit: 999999 }),
      retry: false,
    })),
  })
  // 当前商品所在二级分组的产品列表（同分组产品；列表已由 react-query 缓存，直接遍历取）
  let sameGroupProducts: ProductListItem[] = []
  for (const query of groupGoodsQueries) {
    const list = query.data?.data.list ?? []
    if (list.some((p) => p.id === id)) {
      sameGroupProducts = list
      break
    }
  }

  // 初始化：解析 order_page → 默认值 → 编辑回填 → 联动限制 → 首次算价
  useEffect(() => {
    const data = orderQuery.data
    if (!data || initRef.current) return
    if (fieldsQuery.isPending) return
    initRef.current = true

    const prepared = prepareOptions(data.option ?? [])
    const host = data.product.host?.host
    const password = data.product.password?.password
    const defaults = collectConfigForm(prepared, host, password)
    let initForm = defaults.form
    let initSystem = defaults.curSystem

    // 自定义字段初始值（来自 self_defined_field/order_page）
    const fields = fieldsQuery.data?.data.data ?? []
    // 一次性初始化（查询数据就绪后同步灌入，非渲染派生的级联更新）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomFields(fields)
    const initCustom: Record<string, string> = {}
    for (const item of fields) {
      initCustom[item.id] =
        item.field_type === 'tickbox'
          ? item.is_required === 1
            ? '1'
            : '0'
          : ''
    }

    const backfillCascaderParams: Record<number, number | string> =
      cascaderParamsRef.current

    const storedRaw = sessionStorage.getItem('product_information')
    const stored: StoredProductInformation | null = storedRaw
      ? JSON.parse(storedRaw)
      : null
    const isUpdate = Boolean(change) && Boolean(stored?.config_options)

    if (isUpdate && stored?.config_options) {
      initForm = { ...initForm, ...stored.config_options.configoption }
      // 一次性初始化回填（官方 created() 同步回填语义，非级联渲染）
      if (stored.config_options.cycle) setCycle(stored.config_options.cycle)
      setQty(stored.qty ?? 1)
      setPosition(stored.position)
      initSystem =
        (stored.customfield?.curSystem as string | undefined) ?? initSystem
      const cParams = stored.customfield?.cascaderParams as
        | Record<number, number | string>
        | undefined
      if (cParams) cascaderParamsRef.current = cParams
      const sdf = stored.self_defined_field ?? {}
      for (const key of Object.keys(initCustom)) {
        if (sdf[key] !== undefined) initCustom[key] = sdf[key]
      }
    }
    setCustomObj(initCustom)

    // 级联初始选中（拉取第一级子数据；mf_finance_common 无 link 路由，官方模板仅展示一级）
    const cascaderOptions = prepared.filter(
      (item) => item.option_type === CASCADER_TYPE
    )
    if (cascaderOptions.length > 0) {
      const active: Record<number, number | string> = {}
      for (const item of cascaderOptions) {
        const subs = item.sub as Array<{ id: number }>
        const firstId = subs[0]?.id
        const subId = backfillCascaderParams[item.id] ?? firstId
        active[item.id] = subId
        if (remfHasLinkRoute(module)) {
          fetchRemfCascader(id, { cid: item.id, sub_id: subId }, module)
            .then((res) => {
              const son = res.data?.[0]?.son ?? []
              setCascaderSon((prev) => ({ ...prev, [item.id]: son }))
            })
            .catch(() => {})
        }
      }
      setCascaderActive(active)
    }

    // 联动限制
    const applied = applyInitLimits(prepared, prepared, initForm, data.links ?? [])
    setOptions(applied.options)
    setForm(applied.form)
    setCurSystem(initSystem)
    setInitialized(true)
    setCycle((prev) => prev || data.product.cycle?.[0]?.billingcycle || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderQuery.data, fieldsQuery.isPending, change, id])

  async function runCalcPrice(
    nextForm = form,
    nextCycle = cycle,
    nextQty = qty
  ) {
    const seq = ++priceSeqRef.current
    const params = {
      id,
      config_options: {
        configoption: { ...nextForm },
        cycle: nextCycle,
      },
      qty: nextQty,
    }
    setPriceLoading(true)
    try {
      const res = await fetchProductPrice(id, params)
      if (seq !== priceSeqRef.current) return
      setPriceData(res.data)
    } catch {
      if (seq === priceSeqRef.current) setPriceData(undefined)
    } finally {
      if (seq === priceSeqRef.current) setPriceLoading(false)
    }
  }

  // 算价（变更防抖 400ms，避免滑动条抖动时连发）
  useEffect(() => {
    if (!initialized || !cycle) return
    const timer = setTimeout(() => {
      runCalcPrice()
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, cycle, qty, initialized])

  /** 配置项变更（含联动限制应用） */
  function onOptionChange(item: RemfConfigOptionItem, value: number | string) {
    if (value === form[item.id]) return
    const origin = orderQuery.data?.option ?? []
    const result = handleOptionChange({
      origin,
      options,
      form,
      limit: orderQuery.data?.links ?? [],
      causeId: item.id,
      value,
    })
    setOptions(result.options)
    setForm(result.form)
  }

  function onSystemChange(system: string) {
    if (!curSystem || system === curSystem) return
    setCurSystem(system)
    const item = options.find((o) => o.option_type === SYSTEM_TYPE)
    if (!item) return
    const group = item.sub as Record<string, { child: Array<{ id: number }> }>
    const firstId = group[system]?.child[0]?.id
    if (firstId !== undefined) onOptionChange(item, firstId)
  }

  function onCascaderParent(
    item: RemfConfigOptionItem,
    subId: number | string
  ) {
    if (cascaderActive[item.id] === subId) return
    setCascaderActive((prev) => ({ ...prev, [item.id]: subId }))
    setForm((prev) => ({ ...prev, [item.id]: subId }))
    cascaderParamsRef.current = {
      ...cascaderParamsRef.current,
      [item.id]: subId,
    }
    if (!remfHasLinkRoute(module)) return
    fetchRemfCascader(id, { cid: item.id, sub_id: subId }, module)
      .then((res) => {
        const son = res.data?.[0]?.son ?? []
        setCascaderSon((prev) => ({ ...prev, [item.id]: son }))
      })
      .catch(() => {})
  }

  function onCascaderSon(
    item: RemfConfigOptionItem,
    sonId: number,
    subId: number
  ) {
    if (cascaderSon[item.id]?.find((s) => s.id === sonId)?.checkSubId === subId)
      return
    cascaderParamsRef.current = {
      ...cascaderParamsRef.current,
      [item.id]: subId,
    }
    if (!remfHasLinkRoute(module)) return
    fetchRemfCascader(id, { cid: item.id, sub_id: subId }, module).then(
      (res) => {
        const son = res.data?.[0]?.son ?? []
        setCascaderSon((prev) => ({ ...prev, [item.id]: son }))
      }
    )
  }

  function validate(): string | null {
    return verifyCustomFields(customFields, customObj)
  }

  function buildCartParams() {
    const data = orderQuery.data
    if (!data) return null
    return formatCartParams({
      productId: id,
      form,
      cycle,
      qty,
      position,
      showHost: data.product.host?.show === '1',
      showPassword: data.product.password?.show === '1',
      customfield: { cascaderParams: cascaderParamsRef.current },
      selfDefinedField: customObj,
      cascaderSon,
      curSystem,
    })
  }

  async function addCart() {
    const error = validate()
    if (error) {
      toast.error(error)
      return
    }
    const params = buildCartParams()
    if (!params) return
    setSubmitting(true)
    try {
      const res = await addCartItem(params)
      if (res.status === 200) {
        // 刷新顶栏购物车角标（与 header 同 key 共享缓存）
        queryClient.invalidateQueries({ queryKey: ['cart'] })
        setCartDialog(true)
      } else {
        toast.error(res.msg || '加入购物车失败')
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function changeCart() {
    const error = validate()
    if (error) {
      toast.error(error)
      return
    }
    const params = buildCartParams()
    if (!params || position === undefined) return
    setSubmitting(true)
    try {
      const res = await updateCartItem({
        position,
        product_id: id,
        config_options: params.config_options,
        qty: params.qty,
        customfield: params.customfield,
        self_defined_field: params.self_defined_field,
      })
      toast.success(res.msg || '已修改')
      navigate({ to: '/cart/shoppingCar.htm' })
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  function buyNow() {
    const beforeSettle =
      (commonData?.custom_fields as { before_settle?: number } | undefined)
        ?.before_settle === 1
    if (beforeSettle) {
      navigate({ to: '/account.htm' })
      return
    }
    const error = validate()
    if (error) {
      toast.error(error)
      return
    }
    const params = buildCartParams()
    if (!params) return
    sessionStorage.setItem('product_information', JSON.stringify(params))
    window.location.href = `/cart/settlement.htm?id=${id}`
  }

  /** 切换到同分组产品 */
  function switchTo(productId: number) {
    if (productId === id) return
    sessionStorage.removeItem('product_information')
    navigate({ to: '/cart/goods.htm', search: { id: productId } })
  }

  const loading = orderQuery.isLoading
  const isUpdate = change === true
  const showInfo = priceData?.preview ?? []
  // 概要列表：排除「时长」行（时长在右侧单独选择）
  const summaryRows = showInfo.filter((row) => row.name !== '时长')
  const product = orderQuery.data?.product
  const stockControl = product?.stock_control === 1
  const maxQty = stockControl ? (product?.qty ?? 1) : 99999

  // 分节提取
  const systemOption = options.find((o) => o.option_type === SYSTEM_TYPE)
  const areaOption = options.find((o) => o.option_type === AREA_TYPE)
  const bandwidthOption = options.find((o) => isBandwidthOption(o))
  const cascaderOptions = options.filter((o) => o.option_type === CASCADER_TYPE)
  const moreOptions = options.filter(
    (o) =>
      o.option_type !== SYSTEM_TYPE &&
      o.option_type !== AREA_TYPE &&
      o.option_type !== CASCADER_TYPE &&
      !isBandwidthOption(o)
  )

  return (
    <div className='space-y-4'>
      {loading && (
        <div className='grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_330px]'>
          <div className='overflow-hidden rounded-lg border bg-card shadow-sm'>
            <div className='border-b bg-muted/40 px-5 py-4 sm:px-6'>
              <Skeleton className='h-5 w-2/5' />
            </div>
            <div className='space-y-6 p-5 sm:p-6'>
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className='grid items-start gap-2.5 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4'
                >
                  <Skeleton className='h-4 w-20' />
                  <Skeleton className='h-9 w-full max-w-64' />
                </div>
              ))}
            </div>
          </div>
          <Skeleton className='hidden h-80 lg:block' />
        </div>
      )}

      {orderQuery.error && (
        <Card className='flex flex-col items-center gap-3 py-16 text-center'>
          <p className='text-muted-foreground'>
            配置页加载失败：{getErrorMessage(orderQuery.error)}
          </p>
          <Button variant='outline' onClick={() => orderQuery.refetch()}>
            重试
          </Button>
        </Card>
      )}

      {!loading && !orderQuery.error && initialized && (
        <div className='grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_330px]'>
          {/* 左侧：配置区 */}
          <div className='min-w-0 overflow-hidden rounded-lg border bg-card shadow-sm'>
            <div className='divide-y divide-border/70'>
              {/* 同分组产品（推荐套餐 → 同分组全部产品，点击切换） */}
              {sameGroupProducts.length > 1 && (
                <Section label='同分组产品'>
                  <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'>
                    {sameGroupProducts.map((p) => {
                      const active = p.id === id
                      return (
                        <button
                          key={p.id}
                          type='button'
                          onClick={() => switchTo(p.id)}
                          className={cn(
                            'group relative rounded-lg border p-4 text-left transition-all duration-200',
                            active
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-background hover:border-primary/30 hover:shadow-sm'
                          )}
                        >
                          <div className='flex items-center justify-between gap-2'>
                            <span className='truncate text-sm font-semibold text-foreground'>
                              {p.name}
                            </span>
                            {active && (
                              <span className='shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground'>
                                当前
                              </span>
                            )}
                          </div>
                          <div className='mt-3 flex items-center justify-between text-sm'>
                            <span className='font-bold text-primary'>
                              {currencyPrefix}
                              {formatMoney(p.price)}
                              {p.cycle ? `/${p.cycle}` : ''}
                            </span>
                            {!active && (
                              <span className='text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100'>
                                查看配置 →
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </Section>
              )}

              {/* 镜像（操作系统）：官方 10.7.2 双下拉做法，触发器展示系统 icon+名称+版本+箭头，
                菜单按系统分组展示图标与对勾，切换系统自动选该系统的首个版本 */}
              {systemOption && (
                <Section label='镜像'>
                  <div className='w-full sm:w-72'>
                    <SystemSelector
                      item={systemOption}
                      curSystem={curSystem}
                      version={form[systemOption.id]}
                      onSystemChange={onSystemChange}
                      onVersionChange={(value) =>
                        onOptionChange(systemOption, value)
                      }
                    />
                  </div>
                </Section>
              )}

              {/* 地域（数据中心） */}
              {areaOption && (
                <Section label='地域'>
                  <div className='flex flex-wrap gap-2'>
                    {(
                      areaOption.sub as Array<{
                        id: number
                        option_name: string
                        country_code?: string
                        area: Array<{ id: number }>
                      }>
                    ).map((sub) => {
                      const areaId = sub.area[0]?.id
                      const active = areaId === form[areaOption.id]
                      return (
                        <button
                          key={sub.id}
                          type='button'
                          onClick={() => onOptionChange(areaOption, areaId)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors',
                            active
                              ? 'border-primary bg-primary/5 font-medium text-primary'
                              : 'border-border text-muted-foreground hover:border-primary/40'
                          )}
                        >
                          {sub.country_code && (
                            <img
                              src={`/upload/common/country/${sub.country_code}.png`}
                              alt=''
                              className='h-3.5 w-5 object-cover'
                            />
                          )}
                          {sub.option_name}
                          {active && <Check className='h-3.5 w-3.5 shrink-0' />}
                        </button>
                      )
                    })}
                  </div>
                </Section>
              )}

              {/* 带宽值（数量类 Mbps） */}
              {bandwidthOption && (
                <Section label='带宽值'>
                  {(bandwidthOption.qty_range ?? []).length > 0 &&
                  (bandwidthOption.qty_range?.length ?? 0) <= 10 ? (
                    <div className='flex flex-wrap items-center gap-3'>
                      <div className='flex flex-wrap overflow-hidden rounded-md border border-border'>
                        {bandwidthOption.qty_range!.map((v) => {
                          const active = Number(form[bandwidthOption.id]) === v
                          return (
                            <button
                              key={v}
                              type='button'
                              onClick={() => onOptionChange(bandwidthOption, v)}
                              className={cn(
                                'border-r border-border px-4 py-1.5 text-sm transition-colors last:border-r-0',
                                active
                                  ? 'bg-primary/10 font-medium text-primary'
                                  : 'text-muted-foreground hover:bg-muted'
                              )}
                            >
                              {v}
                            </button>
                          )
                        })}
                      </div>
                      <span className='text-sm text-muted-foreground'>
                        {bandwidthOption.unit}
                      </span>
                    </div>
                  ) : (
                    <ConfigItemControl
                      item={bandwidthOption}
                      value={form[bandwidthOption.id]}
                      systemValue={curSystem}
                      onSystemChange={onSystemChange}
                      onValueChange={(value) =>
                        onOptionChange(bandwidthOption, value)
                      }
                      t={t}
                    />
                  )}
                </Section>
              )}

              {/* 更多配置（与镜像/地域同级，全部展开） */}
              <Section label='更多配置'>
                <div className='space-y-4'>
                  {moreOptions.map((item) => (
                    <ConfigRow key={item.id} label={item.option_name}>
                      <ConfigItemControl
                        item={item}
                        value={form[item.id]}
                        systemValue={curSystem}
                        onSystemChange={onSystemChange}
                        onValueChange={(value) => onOptionChange(item, value)}
                        t={t}
                      />
                    </ConfigRow>
                  ))}

                  {/* 级联配置 */}
                  {cascaderOptions.map((item) => (
                    <ConfigRow key={item.id} label={item.option_name}>
                      <CascaderConfigItem
                        item={item}
                        activeId={cascaderActive[item.id]}
                        sonList={cascaderSon[item.id]}
                        onParentClick={(subId) => onCascaderParent(item, subId)}
                        onSonClick={(sonId, subId) =>
                          onCascaderSon(item, sonId, subId)
                        }
                      />
                    </ConfigRow>
                  ))}

                  {/* 主机名 / 密码 */}
                  {product?.host.show === '1' && (
                    <ConfigRow label={t('fin_host', '主机名')}>
                      <Input
                        className='max-w-56'
                        disabled
                        value={String(form.host ?? '')}
                      />
                    </ConfigRow>
                  )}
                  {product?.password.show === '1' && (
                    <ConfigRow label={t('fin_password', '主机密码')}>
                      <div className='flex min-w-0 flex-wrap items-center gap-2'>
                        <div className='relative w-full max-w-56'>
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            className='pr-9'
                            value={String(form.password ?? '')}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                password: e.target.value,
                              }))
                            }
                          />
                          <button
                            type='button'
                            aria-label={showPassword ? '隐藏密码' : '查看密码'}
                            className='absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                            onClick={() => setShowPassword((prev) => !prev)}
                          >
                            {showPassword ? (
                              <EyeOff className='h-3.5 w-3.5' />
                            ) : (
                              <Eye className='h-3.5 w-3.5' />
                            )}
                          </button>
                        </div>
                        <Button
                          variant='outline'
                          size='icon'
                          className='h-8 w-8 shrink-0'
                          aria-label='刷新密码'
                          onClick={() => {
                            const rule = product?.password.rule
                            if (rule) {
                              setForm((prev) => ({
                                ...prev,
                                password: genPassword(rule),
                              }))
                            }
                          }}
                        >
                          <RefreshCw className='h-3.5 w-3.5' />
                        </Button>
                      </div>
                    </ConfigRow>
                  )}

                  {/* 自定义字段 */}
                  {customFields.length > 0 && (
                    <div className='space-y-4'>
                      {customFields.map((field) => (
                        <ConfigRow
                          key={field.id}
                          label={
                            <>
                              {field.is_required === 1 && (
                                <span className='mr-1 text-destructive'>*</span>
                              )}
                              {field.field_name}
                            </>
                          }
                        >
                          <CustomFieldControl
                            field={field}
                            value={customObj[field.id] ?? ''}
                            onChange={(value) =>
                              setCustomObj((prev) => ({
                                ...prev,
                                [field.id]: value,
                              }))
                            }
                          />
                        </ConfigRow>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            </div>
          </div>
          <div className='w-full shrink-0 overflow-hidden rounded-lg border bg-card shadow-sm lg:sticky lg:top-24 lg:w-80'>
            <div className='border-b bg-muted/40 px-4 py-3'>
              <h3 className='text-sm font-bold text-foreground'>配置概要</h3>
            </div>
            <div className='p-4'>
              <div className='summary-scroll max-h-72 space-y-2 overflow-y-auto pr-1 text-sm'>
                {summaryRows.length > 0 ? (
                  summaryRows.map((row, index) => (
                    <div
                      key={index}
                      className='flex items-center justify-between gap-3'
                    >
                      <span className='shrink-0 text-muted-foreground'>
                        {row.name}
                      </span>
                      <span className='flex min-w-0 items-center gap-1.5'>
                        <PreviewIcon
                          name={row.name}
                          value={row.value}
                          className='shrink-0'
                        />
                        <span className='min-w-0 text-right break-words text-foreground'>
                          {stripPreviewPrefix(row.value)}
                        </span>
                      </span>
                    </div>
                  ))
                ) : (
                  <p className='text-xs text-muted-foreground'>加载中…</p>
                )}
              </div>

              <hr className='my-3 border-border/70' />

              {/* 购买数量 */}
              {Number(orderQuery.data?.allow_qty) === 1 && (
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-muted-foreground'>
                    {t('shoppingCar_goodsNums', '购买数量')}
                  </span>
                  <div className='flex items-center overflow-hidden rounded-md border border-border'>
                    <button
                      type='button'
                      className='px-2 py-1 text-muted-foreground hover:bg-muted disabled:opacity-40'
                      disabled={qty <= 1}
                      onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                      aria-label='减少数量'
                    >
                      <Minus className='h-3.5 w-3.5' />
                    </button>
                    <span className='min-w-10 px-2 text-center text-sm text-foreground'>
                      {qty}
                    </span>
                    <button
                      type='button'
                      className='px-2 py-1 text-muted-foreground hover:bg-muted disabled:opacity-40'
                      disabled={qty >= maxQty}
                      onClick={() =>
                        setQty((prev) => Math.min(maxQty, prev + 1))
                      }
                      aria-label='增加数量'
                    >
                      <Plus className='h-3.5 w-3.5' />
                    </button>
                  </div>
                </div>
              )}

              {/* 购买时长：下拉框选择（官方 el-select 同款） */}
              <div className='mt-3 flex items-center justify-between gap-3'>
                <span className='shrink-0 text-sm text-muted-foreground'>
                  {t('mf_time', '购买时长')}
                </span>
                <Select value={cycle} onValueChange={(v) => setCycle(v)}>
                  <SelectTrigger className='h-9 w-36'>
                    <SelectValue
                      placeholder={t('com_config.please_select', '请选择')}
                    />
                  </SelectTrigger>
                  <SelectContent align='end'>
                    {(product?.cycle ?? []).map((c: RemfConfigCycle) => (
                      <SelectItem key={c.billingcycle} value={c.billingcycle}>
                        {c.billingcycle_zh}付
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='border-t border-border/70 bg-muted/40 p-4'>
              <div className='flex items-baseline justify-between gap-2'>
                <span className='text-sm text-muted-foreground'>
                  {t('config_free', '配置费用')}
                </span>
                <span className='text-2xl font-bold text-primary'>
                  {currencyPrefix}
                  {priceLoading ? (
                    <Loader2 className='inline h-5 w-5 animate-spin' />
                  ) : (
                    formatMoney(priceData?.price_total)
                  )}
                </span>
              </div>

              {showInfo.length > 0 && (
                <div className='mt-1 text-right'>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type='button'
                        className='text-xs text-primary hover:underline'
                      >
                        查看明细 ∧
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align='end' className='w-72'>
                      <p className='mb-2 text-sm font-medium'>
                        {t('config_free_details', '配置费用明细')}
                      </p>
                      <div className='space-y-1.5'>
                        {showInfo.map((row, index) => (
                          <div
                            key={index}
                            className='flex items-center justify-between gap-3 text-[13px]'
                          >
                            <span className='shrink-0 text-muted-foreground'>
                              {row.name}：
                            </span>
                            <span className='flex min-w-0 flex-1 items-center justify-end gap-1.5'>
                              <PreviewIcon
                                name={row.name}
                                value={row.value}
                                className='shrink-0'
                              />
                              <FadeText
                                className='min-w-0 text-right text-foreground'
                                contentClassName='text-foreground'
                              >
                                {stripPreviewPrefix(row.value)}
                              </FadeText>
                            </span>
                            <span className='shrink-0'>
                              {currencyPrefix}
                              {formatMoney(row.price)}
                            </span>
                          </div>
                        ))}
                        <hr className='my-1 border-border/70' />
                        <div className='flex items-center justify-between text-[13px]'>
                          <span className='text-muted-foreground'>
                            {t('mf_total', '合计')}
                          </span>
                          <span className='font-medium'>
                            {currencyPrefix}
                            {formatMoney(priceData?.price_total)}
                          </span>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <div className='mt-4 space-y-2'>
                <Button
                  className='w-full bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90'
                  disabled={submitting}
                  onClick={isUpdate ? changeCart : buyNow}
                >
                  {isUpdate
                    ? t('product_sure_check', '确认修改')
                    : t('product_buy_now', '确认下单')}
                </Button>
                {!isUpdate && (
                  <Button
                    className='w-full py-2'
                    variant='outline'
                    disabled={submitting}
                    onClick={addCart}
                  >
                    {t('product_add_cart', '加入购物车')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 加入购物车成功弹窗 */}
      <Dialog open={cartDialog} onOpenChange={setCartDialog}>
        <DialogContent className='sm:max-w-sm'>
          <DialogTitle className='sr-only'>
            {t('product_tip', '加入购物车成功')}
          </DialogTitle>
          <div className='py-4 text-center'>
            <p className='text-lg font-medium'>
              {t('product_tip', '您已成功加入购物车！')}
            </p>
          </div>
          <DialogFooter className='flex gap-2 sm:justify-center'>
            <Button variant='outline' onClick={() => setCartDialog(false)}>
              {t('product_continue', '继续购物')}
            </Button>
            <Button onClick={() => navigate({ to: '/cart/shoppingCar.htm' })}>
              {t('product_settlement', '去购物车结算')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

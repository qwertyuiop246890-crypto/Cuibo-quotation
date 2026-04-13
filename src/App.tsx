import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, Calculator, Search, Settings, Shield, Receipt, 
  Banknote, Scale, TrendingUp, CreditCard, ShoppingCart, 
  Plane, Truck, Store, Landmark, Users 
} from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  rateMarkup: <TrendingUp size={16} className="opacity-60" />,
  ccFee: <CreditCard size={16} className="opacity-60" />,
  sourcingFee: <ShoppingCart size={16} className="opacity-60" />,
  shippingRate: <Plane size={16} className="opacity-60" />,
  domesticFee: <Truck size={16} className="opacity-60" />,
  platformFee: <Store size={16} className="opacity-60" />,
  taxRate: <Landmark size={16} className="opacity-60" />,
  memberBuffer: <Users size={16} className="opacity-60" />
};

// Types
type ConfigItem = {
  label: string;
  value: number;
  enabled: boolean;
  unit: string;
  step: string;
  group: 'cost' | 'divisor';
};

type Config = {
  rateMarkup: ConfigItem;
  ccFee: ConfigItem;
  sourcingFee: ConfigItem;
  shippingRate: ConfigItem;
  domesticFee: ConfigItem;
  platformFee: ConfigItem;
  taxRate: ConfigItem;
  memberBuffer: ConfigItem;
};

type Result = {
  finalRate: number;
  pureItemTwd: number;
  ccFeeTwd: number;
  shippingTwd: number;
  sourcingFeeTwd: number;
  sourcingFeeLocal: number;
  domesticTwd: number;
  totalCost: number;
  profit: number;
  finalDivisor: string;
  finalPrice: number;
  deductions: {
    tax: number;
    platform: number;
    buffer: number;
  };
};

const IosToggle = ({ checked, onChange }: { checked: boolean; onChange: (val: boolean) => void }) => (
  <button
    type="button"
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-[var(--color-primary)]' : 'bg-[#E9E9EA]'}`}
    onClick={() => onChange(!checked)}
  >
    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
);

export default function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const defaultCountry = (searchParams.get('country') === 'KR' ? 'KR' : 'JP') as 'JP' | 'KR';
  const defaultMode = (searchParams.get('mode') === 'helper' ? 'helper' : 'boss') as 'boss' | 'helper';

  const [price, setPrice] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [bankRate, setBankRate] = useState<string>('0.215');
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [lastRateUpdate, setLastRateUpdate] = useState<string>('');
  
  const [country, setCountry] = useState<'JP' | 'KR'>(defaultCountry);
  const [mode, setMode] = useState<'boss' | 'helper'>(defaultMode);
  
  const [config, setConfig] = useState<Config>({
    rateMarkup: { label: '匯率加碼緩衝', value: 0.01, enabled: true, unit: '', step: '0.001', group: 'cost' },
    ccFee: { label: '國外刷卡費', value: 1.5, enabled: true, unit: '%', step: '0.1', group: 'cost' },
    sourcingFee: { label: '代購費比例', value: 10, enabled: true, unit: '%', step: '1', group: 'cost' },
    shippingRate: { label: '國際空運費', value: 0.25, enabled: true, unit: 'TWD/g', step: '0.001', group: 'cost' },
    domesticFee: { label: '境內運費', value: 150, enabled: true, unit: 'JPY', step: '10', group: 'cost' },
    
    platformFee: { label: '平台刷卡抽成', value: 3, enabled: true, unit: '%', step: '1', group: 'divisor' },
    taxRate: { label: '營業稅 (法規)', value: 5, enabled: true, unit: '%', step: '1', group: 'divisor' },
    memberBuffer: { label: '會員風險緩衝', value: 3, enabled: true, unit: '%', step: '1', group: 'divisor' }
  });

  const [result, setResult] = useState<Result | null>(null);

  const isBossMode = !config.sourcingFee.enabled && !config.shippingRate.enabled && !config.domesticFee.enabled;

  // Effect to handle country switch
  useEffect(() => {
    if (country === 'JP') {
      setBankRate('0.215');
      setConfig(prev => ({
        ...prev,
        rateMarkup: { ...prev.rateMarkup, value: 0.01 },
        sourcingFee: { ...prev.sourcingFee, value: 10 },
        shippingRate: { ...prev.shippingRate, value: 0.25 },
        domesticFee: { ...prev.domesticFee, value: 150, unit: 'JPY' }
      }));
    } else {
      setBankRate('0.024');
      setConfig(prev => ({
        ...prev,
        rateMarkup: { ...prev.rateMarkup, value: 0.001 },
        sourcingFee: { ...prev.sourcingFee, value: 5 },
        shippingRate: { ...prev.shippingRate, value: 0.2 },
        domesticFee: { ...prev.domesticFee, value: 0, unit: 'KRW' }
      }));
    }
    fetchExchangeRate(country);
  }, [country]);

  const fetchExchangeRate = async (targetCountry = country) => {
    setIsFetchingRate(true);
    try {
      const targetUrl = 'https://rate.bot.com.tw/xrt?Lang=zh-TW';
      let htmlContent = '';

      const proxies = [
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
      ];

      let fetchSuccess = false;
      for (const proxy of proxies) {
        try {
          const response = await fetch(proxy);
          if (response.ok) {
            htmlContent = await response.text();
            fetchSuccess = true;
            break;
          }
        } catch (err) {
          console.warn(`Proxy failed:`, err);
        }
      }

      if (!fetchSuccess) {
        throw new Error('All CORS proxies failed to fetch the exchange rate.');
      }
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const rows = doc.querySelectorAll('table tbody tr');
      
      let rate = null;
      const targetCurrency = targetCountry === 'JP' ? 'JPY' : 'KRW';
      for (const row of rows) {
        const currencyText = row.querySelector('.hidden-phone.print_show')?.textContent || '';
        if (currencyText.includes(targetCurrency)) {
          const sellTd = row.querySelector('td[data-table="本行現金賣出"]');
          if (sellTd) {
            rate = parseFloat(sellTd.textContent.trim());
            break;
          }
        }
      }
      
      if (rate && !isNaN(rate)) {
        setBankRate(rate.toFixed(4));
        const now = new Date();
        setLastRateUpdate(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
      } else {
        throw new Error(`Could not parse ${targetCurrency} rate from Bank of Taiwan`);
      }
    } catch (error) {
      console.error('Failed to fetch exchange rate:', error);
    } finally {
      setIsFetchingRate(false);
    }
  };

  const updateConfig = (key: keyof Config, field: keyof ConfigItem, val: any) => {
    setConfig(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }));
  };

  const applyPreset = (type: 'standard' | 'boss') => {
    const isBoss = type === 'boss';
    setConfig(prev => ({
      ...prev,
      sourcingFee: { ...prev.sourcingFee, enabled: !isBoss },
      shippingRate: { ...prev.shippingRate, enabled: !isBoss },
      domesticFee: { ...prev.domesticFee, enabled: !isBoss }
    }));
  };

  useEffect(() => {
    const numPrice = parseFloat(price) || 0;
    const numWeight = parseFloat(weight) || 0;

    if (numPrice <= 0 && numWeight <= 0) {
      setResult(null);
      return;
    }

    const currentRate = parseFloat(bankRate) || 0;
    const rateMarkup = config.rateMarkup.enabled ? (Number(config.rateMarkup.value) || 0) : 0;
    const finalRate = currentRate + rateMarkup;
    
    const pureItemTwd = numPrice * finalRate;
    
    const domesticFee = config.domesticFee.enabled ? (Number(config.domesticFee.value) || 0) : 0;
    const domesticTwd = domesticFee * finalRate;

    const ccFeeRate = config.ccFee.enabled ? ((Number(config.ccFee.value) || 0) / 100) : 0;
    const baseForCcTwd = country === 'KR' ? pureItemTwd : (pureItemTwd + domesticTwd);
    const ccFeeTwd = baseForCcTwd * ccFeeRate;
    
    let shippingTwd = 0;
    if (config.shippingRate.enabled) {
      shippingTwd = numWeight * (Number(config.shippingRate.value) || 0);
    }
    
    const sourcingFeeRate = config.sourcingFee.enabled ? ((Number(config.sourcingFee.value) || 0) / 100) : 0;
    const baseForSourcing = country === 'KR' ? numPrice : (numPrice + domesticFee);
    const sourcingFeeLocal = Math.round(baseForSourcing * sourcingFeeRate);
    const sourcingFeeTwd = sourcingFeeLocal * finalRate;

    const totalCost = pureItemTwd + ccFeeTwd + shippingTwd + sourcingFeeTwd + domesticTwd;

    let profit = 0;
    if (totalCost < 100) profit = 40;
    else if (totalCost < 200) profit = 60;
    else if (totalCost < 300) profit = 80;
    else profit = Math.max(totalCost * 0.2, 100);

    const pfFee = config.platformFee.enabled ? ((Number(config.platformFee.value) || 0) / 100) : 0;
    const txFee = config.taxRate.enabled ? ((Number(config.taxRate.value) || 0) / 100) : 0;
    const mbFee = config.memberBuffer.enabled ? ((Number(config.memberBuffer.value) || 0) / 100) : 0;
    
    const divisorHigh = 1 - (pfFee + txFee + mbFee);
    const divisorLow = 1 - (pfFee + txFee);

    let tempPrice = (totalCost + profit) / divisorHigh;
    let finalDivisor = divisorHigh;

    if (tempPrice < 400) {
      finalDivisor = divisorLow;
      tempPrice = (totalCost + profit) / finalDivisor;
    }

    const ceilPrice = Math.ceil(tempPrice);
    let finalPrice = ceilPrice;
    const lastDigit = ceilPrice % 10;
    
    if (lastDigit !== 0 && lastDigit !== 9) {
      finalPrice = Math.floor(ceilPrice / 10) * 10 + 9;
    }

    const taxAmount = finalPrice * txFee;
    const platformAmount = finalPrice * pfFee;
    const bufferAmount = tempPrice >= 400 ? (finalPrice * mbFee) : 0;

    setResult({
      finalRate,
      pureItemTwd: Math.round(pureItemTwd),
      ccFeeTwd: Math.round(ccFeeTwd),
      shippingTwd: Math.round(shippingTwd),
      sourcingFeeTwd: Math.round(sourcingFeeTwd),
      sourcingFeeLocal,
      domesticTwd: Math.round(domesticTwd),
      totalCost: Math.round(totalCost),
      profit: Math.round(profit),
      finalDivisor: finalDivisor.toFixed(2),
      finalPrice,
      deductions: {
        tax: Math.round(taxAmount),
        platform: Math.round(platformAmount),
        buffer: Math.round(bufferAmount)
      }
    });
  }, [price, weight, bankRate, config, country]);

  const renderConfigGroup = (groupName: 'cost' | 'divisor') => {
    const groupItems = (Object.entries(config) as [keyof Config, ConfigItem][]).filter(([_, item]) => item.group === groupName);
    return (
      <div className="card overflow-hidden">
        {groupItems.map(([key, item], index) => (
          <div key={key} className={`px-4 py-2.5 flex justify-between items-center ${index !== groupItems.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}>
            <span className="text-[14px] font-medium flex items-center gap-2">
              {iconMap[key]}
              {item.label}
            </span>
            <div className="flex items-center gap-3">
              <div className={`transition-all duration-300 flex items-center justify-end ${item.enabled ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'}`}>
                <input 
                  type="number" 
                  inputMode="decimal"
                  step={item.step} 
                  value={item.value} 
                  onChange={(e) => updateConfig(key, 'value', e.target.value === '' ? '' : parseFloat(e.target.value))} 
                  className="input-field text-right text-[14px] font-medium w-20 py-1 px-2 h-8" 
                />
                {item.unit && <span className="text-[12px] opacity-70 ml-1.5 min-w-[36px]">{item.unit}</span>}
              </div>
              <IosToggle checked={item.enabled} onChange={(val) => updateConfig(key, 'enabled', val)} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen font-sans bg-[var(--color-bg)] flex flex-col pb-24 lg:pb-6">
      {/* Header */}
      <div className="bg-[var(--color-bg)]/90 backdrop-blur-md border-b border-[var(--color-border)] py-3 px-6 sticky top-0 z-20">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center justify-center lg:justify-start gap-2.5">
            <img src="/logo.png" alt="Cuibo Logo" className="w-10 h-10 rounded-xl shadow-sm object-cover bg-white" />
            <h1 className="text-xl font-bold tracking-tight">Cuibo報價工具</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Country Toggle */}
            <div className="flex bg-[var(--color-border)] rounded-lg p-1">
              <button onClick={() => setCountry('JP')} className={`px-3 py-1.5 text-sm rounded-md font-bold transition-colors ${country === 'JP' ? 'bg-white shadow-sm text-[var(--color-primary)]' : 'text-gray-500'}`}>🇯🇵 日本</button>
              <button onClick={() => setCountry('KR')} className={`px-3 py-1.5 text-sm rounded-md font-bold transition-colors ${country === 'KR' ? 'bg-white shadow-sm text-[var(--color-primary)]' : 'text-gray-500'}`}>🇰🇷 韓國</button>
            </div>
            {/* Mode Toggle */}
            <div className="flex bg-[var(--color-border)] rounded-lg p-1">
              <button onClick={() => setMode('boss')} className={`px-3 py-1.5 text-sm rounded-md font-bold transition-colors ${mode === 'boss' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-gray-500'}`}>老闆</button>
              <button onClick={() => setMode('helper')} className={`px-3 py-1.5 text-sm rounded-md font-bold transition-colors ${mode === 'helper' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-gray-500'}`}>小幫手</button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-6xl mx-auto p-4 lg:p-6">
        <div className={`grid grid-cols-1 ${mode === 'boss' ? 'lg:grid-cols-12' : 'max-w-md mx-auto'} gap-6 items-start`}>
          
          {/* Left Column */}
          <div className={`${mode === 'boss' ? 'lg:col-span-7' : 'col-span-1'} space-y-5`}>
            {/* Base Inputs */}
            <section>
              <div className="flex items-center gap-1.5 uppercase text-xs font-semibold opacity-70 mb-2 pl-1 tracking-wider">
                <Search size={14} /> 核心查價數據
              </div>
              <div className="card p-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-[var(--color-bg)] rounded-xl p-3 border border-[var(--color-border)]">
                    <label className="text-[12px] opacity-70 flex items-center gap-1 mb-1 font-medium">
                      <Banknote size={14} /> 商品原價 ({country === 'JP' ? 'JPY' : 'KRW'})
                    </label>
                    <input 
                      type="number" inputMode="decimal" value={price} 
                      onChange={(e) => setPrice(e.target.value)} 
                      className="w-full bg-transparent text-2xl font-bold focus:outline-none text-[var(--color-text)]" placeholder="0"
                    />
                  </div>
                  <div className="bg-[var(--color-bg)] rounded-xl p-3 border border-[var(--color-border)]">
                    <label className="text-[12px] opacity-70 flex items-center gap-1 mb-1 font-medium">
                      <Scale size={14} /> 商品重量 (g)
                    </label>
                    <input 
                      type="number" inputMode="decimal" value={weight} 
                      onChange={(e) => setWeight(e.target.value)} 
                      className="w-full bg-transparent text-2xl font-bold focus:outline-none text-[var(--color-text)]" placeholder="0"
                    />
                    {country === 'KR' && (
                      <div className="text-[10px] opacity-60 mt-1 leading-tight">
                        *材積過大或超過90cm請依規定輸入計費重量 (如3號箱填20000g)
                      </div>
                    )}
                  </div>
                </div>
                {mode === 'boss' && (
                  <div className="bg-[var(--color-primary)]/10 rounded-xl p-3 border border-[var(--color-primary)]/20 flex justify-between items-center">
                    <div>
                      <label className="text-[13px] font-bold text-[var(--color-primary)] block">{country === 'JP' ? '日幣' : '韓元'}現金賣出</label>
                      <span className="text-[11px] opacity-60 text-[var(--color-primary)]">{lastRateUpdate ? `最後更新: ${lastRateUpdate}` : '載入中...'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" inputMode="decimal" step="0.0001" value={bankRate} 
                        onChange={(e) => setBankRate(e.target.value)} 
                        className="w-24 bg-transparent text-right text-xl font-bold focus:outline-none text-[var(--color-primary)]" 
                      />
                      <button 
                        onClick={() => fetchExchangeRate()}
                        disabled={isFetchingRate}
                        className={`p-2 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/30 transition-colors ${isFetchingRate ? 'opacity-50' : ''}`}
                        title="更新匯率"
                      >
                        <RefreshCw size={18} className={isFetchingRate ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Helper Mode Result View */}
            {mode === 'helper' && result && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="card bg-[var(--color-primary)] text-white p-6 flex flex-col items-center justify-center shadow-lg shadow-[var(--color-primary)]/20">
                  <div className="text-sm font-medium opacity-80 mb-1">最終報價 (TWD)</div>
                  <div className="text-5xl font-black tracking-tight">${result.finalPrice}</div>
                </div>
              </section>
            )}

            {/* Cost Configs (Hidden in Helper Mode) */}
            {mode === 'boss' && (
              <>
                <section>
                  <div className="flex justify-between items-end mb-2 pl-1">
                    <div className="flex items-center gap-1.5 uppercase text-xs font-semibold opacity-70 tracking-wider">
                      <Settings size={14} /> 採購方案與成本控制
                    </div>
                  </div>
                  <div className="bg-[var(--color-border)] p-1 rounded-lg mb-3 flex">
                    <button 
                      onClick={() => applyPreset('standard')} 
                      className={`flex-1 py-1.5 text-[13px] font-bold rounded-md transition-all ${!isBossMode ? 'bg-[var(--color-card)] shadow-sm text-[var(--color-text)]' : 'opacity-60 hover:opacity-100'}`}
                    >
                      方案 A (標準空運)
                    </button>
                    <button 
                      onClick={() => applyPreset('boss')} 
                      className={`flex-1 py-1.5 text-[13px] font-bold rounded-md transition-all ${isBossMode ? 'bg-[var(--color-card)] shadow-sm text-[var(--color-text)]' : 'opacity-60 hover:opacity-100'}`}
                    >
                      方案 B (老闆帶回)
                    </button>
                  </div>
                  {renderConfigGroup('cost')}
                </section>

                {/* Divisor Configs */}
                <section>
                  <div className="flex items-center gap-1.5 uppercase text-xs font-semibold opacity-70 mb-2 pl-1 tracking-wider">
                    <Shield size={14} /> 逆算除數設定 (隱含成本防禦)
                  </div>
                  {renderConfigGroup('divisor')}
                  <p className="text-[11px] opacity-50 mt-2 px-1 leading-relaxed">
                    系統自動判定：售價低於 400 不計入會員緩衝 (除數 0.92)；高於 400 啟動完整防禦 (除數 0.89)。
                  </p>
                </section>
              </>
            )}
          </div>

          {/* Right Column (Hidden in Helper Mode) */}
          {mode === 'boss' && (
            <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-20">
              {result ? (
                <>
                  {/* Desktop Result Summary */}
                <div className="hidden lg:block card p-6 bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-primary)]/5 border-[var(--color-primary)]/30">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <div className="text-[14px] opacity-80 font-bold mb-1 text-[var(--color-primary)]">最終建議售價</div>
                      <div className="text-5xl font-black tracking-tight text-[var(--color-primary)]"><span className="text-2xl font-bold mr-1 opacity-70">NT$</span>{result.finalPrice}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] opacity-70 font-bold mb-1">預計淨賺</div>
                      <div className="text-2xl font-black text-[#4ade80] bg-[#4ade80]/10 px-3 py-1 rounded-lg inline-block">
                        +{result.profit}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Breakdown */}
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-1.5 uppercase text-xs font-semibold opacity-70 mb-2 pl-1 tracking-wider">
                    <Receipt size={14} /> 深度結構明細清單
                  </div>
                  <div className="card p-5 text-[14px] space-y-3">
                    {/* 成本區塊 */}
                    <div className="flex justify-between opacity-80">
                      <span>商品換算 <span className="text-[11px] opacity-70">({price || 0} {country === 'JP' ? 'JPY' : 'KRW'})</span></span>
                      <span className="font-medium">${result.pureItemTwd}</span>
                    </div>
                    {config.ccFee.enabled && <div className="flex justify-between opacity-80"><span>信用卡費 <span className="text-[11px]">({config.ccFee.value}%)</span></span><span className="font-medium">${result.ccFeeTwd}</span></div>}
                    {config.shippingRate.enabled && <div className="flex justify-between opacity-80"><span>國際運費 <span className="text-[11px]">({weight || 0}g)</span></span><span className="font-medium">${result.shippingTwd}</span></div>}
                    {config.sourcingFee.enabled && <div className="flex justify-between opacity-80"><span>代購服務費 <span className="text-[11px]">({result.sourcingFeeLocal} {country === 'JP' ? 'JPY' : 'KRW'})</span></span><span className="font-medium">${result.sourcingFeeTwd}</span></div>}
                    {config.domesticFee.enabled && <div className="flex justify-between opacity-80"><span>境內運費 <span className="text-[11px]">({config.domesticFee.value} {country === 'JP' ? 'JPY' : 'KRW'})</span></span><span className="font-medium">${result.domesticTwd}</span></div>}
                    
                    <div className="border-t border-[var(--color-border)] pt-3 mt-1 flex justify-between font-bold text-[15px]">
                      <span>基礎總成本加總</span>
                      <span>${result.totalCost}</span>
                    </div>

                    {/* 利潤區塊 */}
                    <div className="border-t border-[var(--color-border)] pt-3 flex justify-between text-[var(--color-primary)] font-bold text-[15px]">
                      <span>階梯保底利潤加持</span>
                      <span>+${result.profit}</span>
                    </div>

                    {/* 逆算抵扣區塊 */}
                    <div className="border-t border-[var(--color-border)] pt-3">
                      <div className="text-[11px] opacity-60 mb-2 font-medium">自最終售價逆算扣除之隱形成本 (除數: {result.finalDivisor})</div>
                      <div className="space-y-1.5">
                        {config.platformFee.enabled && <div className="flex justify-between opacity-70 text-[13px]"><span>平台刷卡抽成</span><span>-${result.deductions.platform}</span></div>}
                        {config.taxRate.enabled && <div className="flex justify-between opacity-70 text-[13px]"><span>營業稅支出</span><span>-${result.deductions.tax}</span></div>}
                        {config.memberBuffer.enabled && result.deductions.buffer > 0 && <div className="flex justify-between opacity-70 text-[13px]"><span>會員折扣吸收</span><span>-${result.deductions.buffer}</span></div>}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <div className="hidden lg:flex h-full min-h-[400px] items-center justify-center border-2 border-dashed border-[var(--color-border)] rounded-2xl opacity-50">
                <div className="text-center">
                  <div className="text-4xl mb-3">🧮</div>
                  <p className="font-medium">請在左側輸入商品原價與重量<br/>以查看報價結果</p>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Mobile Fixed Bottom Bar */}
      <div className={`lg:hidden fixed bottom-0 left-0 right-0 bg-[var(--color-card)]/95 backdrop-blur-xl border-t border-[var(--color-border)] p-4 pb-safe transition-transform duration-500 z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] ${result ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="max-w-md mx-auto flex justify-between items-center pb-1">
          <div>
            <div className="text-[12px] opacity-70 font-bold mb-0.5 text-[var(--color-primary)]">最終建議售價</div>
            <div className="text-3xl font-black tracking-tight text-[var(--color-primary)]"><span className="text-base font-bold mr-1 opacity-70">NT$</span>{result?.finalPrice || 0}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] opacity-70 font-bold mb-1">預計淨賺</div>
            <div className="text-xl font-black text-[#4ade80] bg-[#4ade80]/10 px-3 py-1 rounded-lg inline-block">
              +{result?.profit || 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


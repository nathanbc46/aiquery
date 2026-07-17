<template>
  <div class="max-w-7xl mx-auto px-4 py-6 space-y-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Token Usage</h1>
        <button @click="showPricing = true"
          class="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all"
          title="ดูตารางราคา Model">
          <CircleHelp class="w-4 h-4" />
        </button>
      </div>
      <div class="flex gap-2">
        <button
          v-for="d in [7, 30, 90]"
          :key="d"
          @click="days = d"
          :class="[
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            days === d
              ? 'bg-violet-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          ]"
        >
          {{ d }} วัน
        </button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div v-if="data" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">จำนวนการเรียกใช้</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ data.summary.totalCalls.toLocaleString() }}</p>
        <p class="text-xs text-gray-400 mt-1">ครั้ง</p>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Token Input รวม</p>
        <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ formatNumber(data.summary.totalTokensIn) }}</p>
        <p class="text-xs text-gray-400 mt-1">tokens</p>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Token Output รวม</p>
        <p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ formatNumber(data.summary.totalTokensOut) }}</p>
        <p class="text-xs text-gray-400 mt-1">tokens</p>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">ค่าใช้จ่ายโดยประมาณ</p>
        <p class="text-2xl font-bold text-amber-600 dark:text-amber-400">{{ data.summary.totalCostTHB.toFixed(2) }}</p>
        <p class="text-xs text-gray-400 mt-1">บาท (THB)</p>
      </div>
    </div>

    <!-- By Endpoint -->
    <div v-if="data && data.byEndpoint.length > 0" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div class="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <h2 class="font-semibold text-gray-800 dark:text-gray-200">สรุปแยกตาม Endpoint</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700">
              <th class="px-4 py-3 text-left font-medium">Endpoint</th>
              <th class="px-4 py-3 text-right font-medium">จำนวนครั้ง</th>
              <th class="px-4 py-3 text-right font-medium">Token In</th>
              <th class="px-4 py-3 text-right font-medium">Token Out</th>
              <th class="px-4 py-3 text-right font-medium">ค่าใช้จ่าย (THB)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-for="ep in data.byEndpoint" :key="ep.endpoint" class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ ep.label }}</td>
              <td class="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{{ ep.calls.toLocaleString() }}</td>
              <td class="px-4 py-3 text-right text-blue-600 dark:text-blue-400">{{ formatNumber(ep.tokensIn) }}</td>
              <td class="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{{ formatNumber(ep.tokensOut) }}</td>
              <td class="px-4 py-3 text-right text-amber-600 dark:text-amber-400 font-medium">{{ ep.costTHB.toFixed(4) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Recent Calls -->
    <div v-if="data && data.recent.length > 0" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div class="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <h2 class="font-semibold text-gray-800 dark:text-gray-200">รายการล่าสุด (100 รายการ)</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700">
              <th class="px-4 py-3 text-left font-medium">เวลา</th>
              <th class="px-4 py-3 text-left font-medium">Endpoint</th>
              <th class="px-4 py-3 text-left font-medium">Model</th>
              <th class="px-4 py-3 text-right font-medium">Token In</th>
              <th class="px-4 py-3 text-right font-medium">Token Out</th>
              <th class="px-4 py-3 text-right font-medium">รอบ</th>
              <th class="px-4 py-3 text-right font-medium">เวลา (ms)</th>
              <th class="px-4 py-3 text-right font-medium">ราคา (THB)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-for="r in data.recent" :key="r.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ formatDate(r.createdAt) }}</td>
              <td class="px-4 py-2.5 text-gray-800 dark:text-gray-200">{{ r.label }}</td>
              <td class="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{{ shortModel(r.modelUsed) }}</td>
              <td class="px-4 py-2.5 text-right text-blue-600 dark:text-blue-400">{{ r.tokensIn.toLocaleString() }}</td>
              <td class="px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400">{{ r.tokensOut.toLocaleString() }}</td>
              <td class="px-4 py-2.5 text-right text-gray-500 dark:text-gray-400">{{ r.iterations }}</td>
              <td class="px-4 py-2.5 text-right text-gray-500 dark:text-gray-400">{{ r.durationMs ?? '-' }}</td>
              <td class="px-4 py-2.5 text-right text-amber-600 dark:text-amber-400">{{ r.costTHB.toFixed(4) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Empty -->
    <div v-if="data && data.summary.totalCalls === 0" class="text-center py-16 text-gray-400 dark:text-gray-500">
      <p class="text-lg">ยังไม่มีข้อมูลใน {{ days }} วันที่ผ่านมา</p>
    </div>

    <!-- Loading -->
    <div v-if="pending" class="flex justify-center py-16">
      <div class="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
    </div>

    <!-- Pricing Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showPricing" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showPricing = false" />
          <div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] flex flex-col">
            <!-- Modal Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <div>
                <h3 class="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <CircleHelp class="w-4 h-4 text-violet-500" />
                  ตารางราคา Gemini Models
                </h3>
                <p class="text-xs text-gray-400 mt-0.5">อัตราแลกเปลี่ยน 35 THB/USD · คำนวณจากราคา Google AI Studio</p>
              </div>
              <button @click="showPricing = false"
                class="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">
                <X class="w-4 h-4" />
              </button>
            </div>

            <!-- Modal Body -->
            <div class="overflow-y-auto p-6">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <th class="px-4 py-3 text-left font-semibold rounded-l-lg">Model</th>
                    <th class="px-4 py-3 text-right font-semibold">Input<br><span class="font-normal text-gray-400">(USD / 1M tokens)</span></th>
                    <th class="px-4 py-3 text-right font-semibold">Output<br><span class="font-normal text-gray-400">(USD / 1M tokens)</span></th>
                    <th class="px-4 py-3 text-right font-semibold rounded-r-lg">Input<br><span class="font-normal text-gray-400">(THB / 1M tokens)</span></th>
                    <th class="px-4 py-3 text-right font-semibold rounded-r-lg">Output<br><span class="font-normal text-gray-400">(THB / 1M tokens)</span></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                  <tr v-for="m in (data?.modelPricing ?? [])" :key="m.name"
                    class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td class="px-4 py-3">
                      <span class="font-mono text-xs font-semibold text-gray-800 dark:text-gray-200">{{ m.name }}</span>
                    </td>
                    <td class="px-4 py-3 text-right text-blue-600 dark:text-blue-400 font-mono text-xs">${{ m.inUSD }}</td>
                    <td class="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-mono text-xs">${{ m.outUSD }}</td>
                    <td class="px-4 py-3 text-right text-blue-700 dark:text-blue-300 font-mono text-xs">฿{{ m.inTHB }}</td>
                    <td class="px-4 py-3 text-right text-emerald-700 dark:text-emerald-300 font-mono text-xs">฿{{ m.outTHB }}</td>
                  </tr>
                </tbody>
              </table>

              <div class="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-300">
                <strong>หมายเหตุ:</strong> ราคาเป็นการประมาณการเท่านั้น อัตราแลกเปลี่ยน {{ data?.thbPerUsd ?? 35 }} THB/USD · ราคาจริงอาจแตกต่างตาม Google AI Studio Pricing และ context caching
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { CircleHelp, X } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const days = ref(30)
const showPricing = ref(false)

const { data, pending, refresh } = useFetch('/api/admin/token-usage', {
  query: computed(() => ({ days: days.value })),
  watch: [days],
})

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function formatDate(d: string | Date | null): string {
  if (!d) return '-'
  return new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

function shortModel(m: string | null | undefined): string {
  if (!m) return '-'
  return m.replace('gemini-', '').replace('-preview', '')
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease;
}
.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
}
</style>

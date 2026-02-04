import { ScheduleItemData } from '@/contexts/ScheduleContext/types'
import { ScheduleItem } from '@prisma/client'
import ScheduleItemComponent from './scheduleItem'

type Props = {
  group: ScheduleItemData
  setSelectedItem?: (item: ScheduleItem | null) => void
  selectedItem?: ScheduleItem | null
}
export default function ScheduleGroupItem({ group, setSelectedItem, selectedItem }: Props) {
  if (group.group === null) {
    return (
      <ScheduleItemComponent
        item={group.items[0]}
        setSelectedItem={setSelectedItem}
        selectedItem={selectedItem}
      />
    )
  }
  return <div>ScheduleGroupItem</div>
}

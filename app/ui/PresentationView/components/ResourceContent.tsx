import { memo, useMemo } from 'react'
import { type Variants } from 'framer-motion'
import { AnimationType } from '@/lib/animations'
import { AnimatedText } from './AnimatedText'
import { BibleTextRender } from './BibleTextRender'
import PresentationRender from './PresentationRender'
import { PresentationViewProps, TextBoundsValues } from '../types'

type Props = {
  currentItem: PresentationViewProps['items'][number]
  isLive: boolean
  currentIndex: number
  presentationVerseBySlideKey?: Record<string, number>
  animationType: AnimationType
  variants: Variants
  textStyle: React.CSSProperties
  theme: PresentationViewProps['theme']
  calculatedSmallFontSize: string
  textContainerPadding: {
    horizontal: number
    vertical: number
  }
  textContainerOffset: {
    x: number
    y: number
  }
  verticalAlign: 'top' | 'center' | 'bottom'
  scaleFactor: number
  presentationHeight: number
  showTextBounds: boolean
  textBoundsIsSelected: boolean
  bibleVerseIsSelected: boolean
  textBoundsBaseValues: TextBoundsValues
  textBoundsScale: {
    x: number
    y: number
  }
  onTextBoundsChange: PresentationViewProps['onTextBoundsChange']
  onBibleVersePositionChange: PresentationViewProps['onBibleVersePositionChange']
  onBibleVerseWidthChange: PresentationViewProps['onBibleVerseWidthChange']
  onBibleVerseTranslateXChange: PresentationViewProps['onBibleVerseTranslateXChange']
  onBibleVerseHorizontalBoundsChange: PresentationViewProps['onBibleVerseHorizontalBoundsChange']
  onEditableTargetSelect: PresentationViewProps['onEditableTargetSelect']
  hideTextInLive: boolean
  blockBgStyle: React.CSSProperties | null
  blockBgPadding: number | null
  animationDuration: number
}

function ResourceContentComponent({
  currentItem,
  isLive,
  currentIndex,
  presentationVerseBySlideKey,
  animationType,
  variants,
  textStyle,
  theme,
  calculatedSmallFontSize,
  textContainerPadding,
  textContainerOffset,
  verticalAlign,
  scaleFactor,
  presentationHeight,
  showTextBounds,
  textBoundsIsSelected,
  bibleVerseIsSelected,
  textBoundsBaseValues,
  textBoundsScale,
  onTextBoundsChange,
  onBibleVersePositionChange,
  onBibleVerseWidthChange,
  onBibleVerseTranslateXChange,
  onBibleVerseHorizontalBoundsChange,
  onEditableTargetSelect,
  hideTextInLive,
  blockBgStyle,
  blockBgPadding,
  animationDuration
}: Props) {
  const nonBibleAnimatedItem = useMemo(
    () => ({
      ...currentItem,
      verse: undefined
    }),
    [currentItem]
  )

  if (currentItem.resourceType === 'PRESENTATION') {
    return (
      <PresentationRender
        item={currentItem}
        currentIndex={currentIndex}
        presentationVerseBySlideKey={presentationVerseBySlideKey}
        theme={theme}
        smallFontSize={calculatedSmallFontSize}
        scaleFactor={scaleFactor}
        presentationHeight={presentationHeight}
        animationType={animationType}
        variants={variants}
        textStyle={textStyle}
        isPreview={!isLive}
        textContainerPadding={textContainerPadding}
        textContainerOffset={textContainerOffset}
        verticalAlign={verticalAlign}
        showTextBounds={showTextBounds}
        textBoundsIsSelected={textBoundsIsSelected}
        textBoundsBaseValues={textBoundsBaseValues}
        textBoundsScale={textBoundsScale}
        onTextBoundsChange={onTextBoundsChange}
        onEditableTargetSelect={onEditableTargetSelect}
        hideTextInLive={hideTextInLive}
        blockBgStyle={blockBgStyle}
        blockBgPadding={blockBgPadding}
        animationDuration={animationDuration}
      />
    )
  }

  if (currentItem.resourceType === 'BIBLE') {
    return (
      <BibleTextRender
        item={currentItem}
        animationType={animationType}
        variants={variants}
        textStyle={textStyle}
        isPreview={!isLive}
        theme={theme}
        smallFontSize={calculatedSmallFontSize}
        textContainerPadding={textContainerPadding}
        textContainerOffset={textContainerOffset}
        verticalAlign={verticalAlign}
        scaleFactor={scaleFactor}
        presentationHeight={presentationHeight}
        showTextBounds={showTextBounds}
        textBoundsIsSelected={textBoundsIsSelected}
        bibleVerseIsSelected={bibleVerseIsSelected}
        textBoundsBaseValues={textBoundsBaseValues}
        textBoundsScale={textBoundsScale}
        onTextBoundsChange={onTextBoundsChange}
        onBibleVersePositionChange={onBibleVersePositionChange}
        onBibleVerseWidthChange={onBibleVerseWidthChange}
        onBibleVerseTranslateXChange={onBibleVerseTranslateXChange}
        onBibleVerseHorizontalBoundsChange={onBibleVerseHorizontalBoundsChange}
        onEditableTargetSelect={onEditableTargetSelect}
        hideTextInLive={hideTextInLive}
        blockBgStyle={blockBgStyle}
        blockBgPadding={blockBgPadding}
        animationDuration={animationDuration}
      />
    )
  }

  return (
    <AnimatedText
      item={nonBibleAnimatedItem}
      animationType={animationType}
      variants={variants}
      textStyle={textStyle}
      isPreview={!isLive}
      textContainerPadding={textContainerPadding}
      textContainerOffset={textContainerOffset}
      verticalAlign={verticalAlign}
      showTextBounds={showTextBounds}
      textBoundsIsSelected={textBoundsIsSelected}
      textBoundsBaseValues={textBoundsBaseValues}
      textBoundsScale={textBoundsScale}
      onTextBoundsChange={onTextBoundsChange}
      onEditableTargetSelect={onEditableTargetSelect}
      hideTextInLive={hideTextInLive}
      blockBgStyle={blockBgStyle}
      blockBgPadding={blockBgPadding}
      animationDuration={animationDuration}
    />
  )
}

function areResourceContentPropsEqual(prevProps: Props, nextProps: Props) {
  return (
    prevProps.currentItem === nextProps.currentItem &&
    prevProps.isLive === nextProps.isLive &&
    prevProps.currentIndex === nextProps.currentIndex &&
    prevProps.presentationVerseBySlideKey === nextProps.presentationVerseBySlideKey &&
    prevProps.animationType === nextProps.animationType &&
    prevProps.variants === nextProps.variants &&
    prevProps.textStyle === nextProps.textStyle &&
    prevProps.theme === nextProps.theme &&
    prevProps.calculatedSmallFontSize === nextProps.calculatedSmallFontSize &&
    prevProps.textContainerPadding.horizontal === nextProps.textContainerPadding.horizontal &&
    prevProps.textContainerPadding.vertical === nextProps.textContainerPadding.vertical &&
    prevProps.textContainerOffset.x === nextProps.textContainerOffset.x &&
    prevProps.textContainerOffset.y === nextProps.textContainerOffset.y &&
    prevProps.verticalAlign === nextProps.verticalAlign &&
    prevProps.scaleFactor === nextProps.scaleFactor &&
    prevProps.presentationHeight === nextProps.presentationHeight &&
    prevProps.showTextBounds === nextProps.showTextBounds &&
    prevProps.textBoundsIsSelected === nextProps.textBoundsIsSelected &&
    prevProps.bibleVerseIsSelected === nextProps.bibleVerseIsSelected &&
    prevProps.textBoundsBaseValues === nextProps.textBoundsBaseValues &&
    prevProps.textBoundsScale === nextProps.textBoundsScale &&
    prevProps.onTextBoundsChange === nextProps.onTextBoundsChange &&
    prevProps.onBibleVersePositionChange === nextProps.onBibleVersePositionChange &&
    prevProps.onBibleVerseWidthChange === nextProps.onBibleVerseWidthChange &&
    prevProps.onBibleVerseTranslateXChange === nextProps.onBibleVerseTranslateXChange &&
    prevProps.onBibleVerseHorizontalBoundsChange === nextProps.onBibleVerseHorizontalBoundsChange &&
    prevProps.onEditableTargetSelect === nextProps.onEditableTargetSelect &&
    prevProps.hideTextInLive === nextProps.hideTextInLive &&
    prevProps.blockBgStyle === nextProps.blockBgStyle &&
    prevProps.blockBgPadding === nextProps.blockBgPadding &&
    prevProps.animationDuration === nextProps.animationDuration
  )
}

export const ResourceContent = memo(ResourceContentComponent, areResourceContentPropsEqual)

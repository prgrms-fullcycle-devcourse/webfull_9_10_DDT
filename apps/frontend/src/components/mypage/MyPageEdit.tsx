'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { BackButton } from '@/components/layout/BackButton';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormInput } from '@/components/ui/form-input';
import { Label } from '@/components/ui/label';
import { ProfileImagePicker } from '@/components/common/ProfileImagePicker';
import { getUsers } from '@/api/generated/users-사용자/users-사용자';
import type { UpdateUserDto } from '@/api/generated/models/updateUserDto';
import { getErrorMessage } from '@/lib/error';
import {
  PROFILE_IMAGE_OPTIONS,
  getLegacyProfileImageKey,
  getProfileImageOptionKey,
} from '@/lib/profileImage';
import { useAuth } from '@/hooks/useAuth';

type UserProfile = {
  userId: string;
  nickname: string;
  email: string;
  profileImage?: string;
};

const NICKNAME_MIN_LENGTH = 2;
const NICKNAME_MAX_LENGTH = 20;

/**
 * 프로필 수정 화면. 닉네임(2~20자)·프로필 이미지를 수정해 저장하거나 회원 탈퇴를 처리한다.
 * 저장 성공 시 전역 me를 갱신하고 마이페이지로 복귀한다. RequireAuth로 로그인 사용자만 접근 가능.
 */
export function MyPageEdit() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState('');

  const selectedProfileKey = PROFILE_IMAGE_OPTIONS[selectedProfile]?.key;
  const { logout, refetchMe } = useAuth();

  useEffect(() => {
    // baseURL·토큰·응답 언래핑은 전역 axiosClient 인터셉터가 처리한다.
    const usersApi = getUsers();

    const loadProfile = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await usersApi.usersControllerGetMe();
        const data = response.data as UserProfile | undefined;

        if (!data) {
          throw new Error('프로필을 불러오지 못했어요.');
        }

        setNickname(data.nickname ?? '');

        const optionKey = getProfileImageOptionKey(data.profileImage);
        const index = PROFILE_IMAGE_OPTIONS.findIndex(
          (item) => item.key === optionKey,
        );
        setSelectedProfile(index >= 0 ? index : 0);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : '불러오기에 실패했어요.',
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfile();
  }, []);

  const trimmedLength = nickname.trim().length;
  const isValid =
    trimmedLength >= NICKNAME_MIN_LENGTH &&
    trimmedLength <= NICKNAME_MAX_LENGTH;
  // 한 글자만 입력해 비활성 상태일 때 이유를 안내한다.
  const showMinLengthHint =
    trimmedLength > 0 && trimmedLength < NICKNAME_MIN_LENGTH;

  const handleSave = async () => {
    if (!isValid) return;

    setIsSaving(true);
    setError('');

    try {
      const updateUserDto: UpdateUserDto = {
        nickname: nickname.trim(),
        profileImage: getLegacyProfileImageKey(selectedProfileKey),
      };

      await getUsers().usersControllerUpdateMe(updateUserDto);

      // 전역 me(헤더 등 다른 화면의 닉네임·프로필)도 최신화한다.
      await refetchMe();

      toast.success('프로필이 저장되었어요.');
      router.push('/mypage');
    } catch (err) {
      const message = getErrorMessage(err, '저장에 실패했습니다.');
      toast.error(message);
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    setError('');

    try {
      await getUsers().usersControllerDeleteMe();

      logout();
      router.push('/');
    } catch (err) {
      const message = getErrorMessage(err, '회원 탈퇴에 실패했어요.');
      toast.error(message);
      setError(message);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <RequireAuth>
      <MobileLayout
        header={
          <>
            <BackButton />
            <HeaderTitle>프로필 수정</HeaderTitle>
            <div className='flex-1' />
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='border border-white/20 px-3 py-3 rounded-sm!'
              onClick={handleDelete}
              disabled={isSaving || isDeleting}
            >
              {isDeleting ? '탈퇴 중...' : '회원 탈퇴'}
            </Button>
          </>
        }
        bottomButton={
          <Button
            onClick={handleSave}
            disabled={!isValid || isSaving || isLoading}
            size='cta'
            className='disabled:bg-secondary disabled:text-muted-foreground'
          >
            {isSaving ? '저장 중...' : '저장하기'}
          </Button>
        }
      >
        <div className='flex flex-col gap-6 pt-2'>
          <div className='flex flex-col gap-2'>
            <Label className='text-[15px] font-bold text-white/85'>
              내 닉네임
            </Label>
            <FormInput
              type='text'
              placeholder='새로운 닉네임을 입력해주세요.'
              maxLength={NICKNAME_MAX_LENGTH}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
            <div className='flex justify-between text-xs'>
              <span className='text-[#FFB3C0]'>
                {showMinLengthHint
                  ? `닉네임은 ${NICKNAME_MIN_LENGTH}자 이상 입력해주세요.`
                  : ''}
              </span>
              <span className='text-[#6B7280]'>
                {nickname.length}/{NICKNAME_MAX_LENGTH}
              </span>
            </div>
          </div>

          <ProfileImagePicker
            selectedProfile={selectedProfile}
            onSelectProfile={setSelectedProfile}
            description='원하는 이미지를 선택해주세요.'
          />

          {error ? (
            <div className='rounded-[14px] border border-[#FF606B]/20 bg-[#2C1722] px-4 py-3 text-sm text-[#FFB3C0]'>
              {error}
            </div>
          ) : null}
        </div>
      </MobileLayout>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              회원 탈퇴하면 <br /> 데이터가 사라져요.
            </DialogTitle>
            <DialogDescription>정말로 탈퇴하시겠어요?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className='flex-1 h-12 rounded-lg bg-destructive hover:bg-destructive/80 text-white font-bold border-none'
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? '탈퇴 중...' : '탈퇴'}
            </Button>
            <Button
              variant='secondary'
              className='flex-1 h-12 rounded-lg'
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              아니요
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RequireAuth>
  );
}
